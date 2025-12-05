# Multi-Region Deployment Guide

## Overview

This guide explains how to deploy PANaCEa with multi-region redundancy to reduce latency for geographically distributed users. This is essential as the user base grows across different regions (e.g., West Coast vs. East Coast).

## Architecture

### Components

1. **Primary Database (Write Master)**: Single source of truth for all write operations
2. **Read Replicas**: Region-specific replicas for read operations
3. **Application Servers**: Deployed in each region
4. **Load Balancer**: Routes requests based on geographic location

### Deployment Topology

```
┌─────────────────────────────────────────────────────────────┐
│                      Load Balancer                           │
│              (Geographic Routing Enabled)                     │
└──────────┬─────────────────────────────────┬────────────────┘
           │                                   │
           │                                   │
    ┌──────▼────────┐                  ┌──────▼────────┐
    │  US-WEST-2    │                  │  US-EAST-1    │
    │  App Server   │                  │  App Server   │
    └──────┬────────┘                  └──────┬────────┘
           │                                   │
           │                                   │
    ┌──────▼────────┐                  ┌──────▼────────┐
    │  Read Replica │                  │  Read Replica │
    │   (Postgres)  │                  │   (Postgres)  │
    └───────────────┘                  └───────────────┘
           │                                   │
           └───────────────┬───────────────────┘
                           │
                    ┌──────▼────────┐
                    │ Primary DB    │
                    │ (US-WEST-2)   │
                    └───────────────┘
```

## Database Configuration

### 1. Set Up Primary Database

Your primary database should be configured for logical replication:

```sql
-- Enable logical replication
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_replication_slots = 10;
ALTER SYSTEM SET max_wal_senders = 10;

-- Restart PostgreSQL
```

### 2. Create Read Replicas

#### Using PostgreSQL Streaming Replication

**On Primary Server:**

```sql
-- Create replication user
CREATE USER replication_user REPLICATION LOGIN ENCRYPTED PASSWORD 'your_password';

-- Configure pg_hba.conf
-- Add line: host replication replication_user replica_ip/32 md5
```

**On Replica Server:**

```bash
# Stop PostgreSQL
sudo systemctl stop postgresql

# Clear data directory
sudo rm -rf /var/lib/postgresql/14/main/*

# Base backup from primary
sudo -u postgres pg_basebackup -h primary_ip -D /var/lib/postgresql/14/main -U replication_user -v -P -W

# Create standby.signal
sudo -u postgres touch /var/lib/postgresql/14/main/standby.signal

# Configure postgresql.conf
echo "primary_conninfo = 'host=primary_ip port=5432 user=replication_user password=your_password'" | sudo tee -a /var/lib/postgresql/14/main/postgresql.auto.conf

# Start PostgreSQL
sudo systemctl start postgresql
```

#### Using Neon Database (Cloud Solution)

If using Neon (recommended for simplicity):

```typescript
// In your .env files

// Primary write connection
DATABASE_URL="postgresql://user:pass@ep-primary.neon.tech/dbname"

// Read replicas (automatically provided by Neon)
DATABASE_READ_REPLICA_US_WEST="postgresql://user:pass@ep-west.neon.tech/dbname"
DATABASE_READ_REPLICA_US_EAST="postgresql://user:pass@ep-east.neon.tech/dbname"
```

## Application Configuration

### 1. Update Prisma Configuration

Create `lib/database/connectionPool.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

// Determine region from environment or geolocation
const region = process.env.AWS_REGION || 'us-west-2';

// Map regions to database URLs
const readReplicaUrls: Record<string, string> = {
  'us-west-2': process.env.DATABASE_READ_REPLICA_US_WEST || process.env.DATABASE_URL,
  'us-west-1': process.env.DATABASE_READ_REPLICA_US_WEST || process.env.DATABASE_URL,
  'us-east-1': process.env.DATABASE_READ_REPLICA_US_EAST || process.env.DATABASE_URL,
  'us-east-2': process.env.DATABASE_READ_REPLICA_US_EAST || process.env.DATABASE_URL,
};

// Create separate clients for read and write
export const prismaWrite = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});

export const prismaRead = new PrismaClient({
  datasources: {
    db: {
      url: readReplicaUrls[region] || process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});

// Helper functions
export function isReadOperation(operation: string): boolean {
  return ['findMany', 'findUnique', 'findFirst', 'count', 'aggregate'].includes(operation);
}

// Smart routing: use read replica for reads, primary for writes
export function getPrismaClient(operation: string = 'read'): PrismaClient {
  if (isReadOperation(operation)) {
    return prismaRead;
  }
  return prismaWrite;
}

// Cleanup on shutdown
process.on('beforeExit', async () => {
  await prismaWrite.$disconnect();
  await prismaRead.$disconnect();
});
```

### 2. Update Application Code

Modify `lib/prisma.ts` to use the new connection pool:

```typescript
import { getPrismaClient, prismaWrite, prismaRead } from './database/connectionPool';

// Export for direct use
export { prismaWrite, prismaRead };

// Export smart routing function
export const prisma = new Proxy(prismaWrite, {
  get(target, prop) {
    const operation = String(prop);
    const client = getPrismaClient(operation);
    return client[prop as keyof typeof client];
  },
}) as typeof prismaWrite;
```

### 3. Update Server Endpoints

No changes needed if using the smart routing proxy. Alternatively, be explicit:

```typescript
import { prismaRead, prismaWrite } from './lib/prisma';

// Read operation
app.get('/api/questions', async (req, res) => {
  const questions = await prismaRead.preGeneratedQuestion.findMany({
    take: 10,
  });
  res.json({ questions });
});

// Write operation
app.post('/api/questions/flag', async (req, res) => {
  const flag = await prismaWrite.questionFlag.create({
    data: req.body,
  });
  res.json({ flag });
});
```

## Infrastructure Deployment

### AWS Deployment

#### 1. Create EC2 Instances in Multiple Regions

```bash
# US-WEST-2
aws ec2 run-instances \
  --image-id ami-xxxxx \
  --instance-type t3.medium \
  --region us-west-2 \
  --user-data file://setup-script.sh

# US-EAST-1
aws ec2 run-instances \
  --image-id ami-xxxxx \
  --instance-type t3.medium \
  --region us-east-1 \
  --user-data file://setup-script.sh
```

#### 2. Set Up Application Load Balancer

```bash
# Create target groups in each region
aws elbv2 create-target-group \
  --name panacea-west \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-xxxxx \
  --region us-west-2

# Create load balancer
aws elbv2 create-load-balancer \
  --name panacea-lb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx \
  --region us-west-2
```

#### 3. Configure Route 53 for Geographic Routing

```json
{
  "Changes": [
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.panacea.app",
        "Type": "A",
        "SetIdentifier": "US-WEST",
        "GeoLocation": {
          "ContinentCode": "NA",
          "CountryCode": "US",
          "SubdivisionCode": "CA"
        },
        "AliasTarget": {
          "HostedZoneId": "Z123456",
          "DNSName": "west-lb.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.panacea.app",
        "Type": "A",
        "SetIdentifier": "US-EAST",
        "GeoLocation": {
          "ContinentCode": "NA",
          "CountryCode": "US",
          "SubdivisionCode": "NY"
        },
        "AliasTarget": {
          "HostedZoneId": "Z789012",
          "DNSName": "east-lb.elb.amazonaws.com",
          "EvaluateTargetHealth": true
        }
      }
    }
  ]
}
```

### Docker Deployment

Create `docker-compose.multi-region.yml`:

```yaml
version: '3.8'

services:
  app-west:
    build: .
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - DATABASE_READ_REPLICA=${DATABASE_READ_REPLICA_US_WEST}
      - AWS_REGION=us-west-2
      - PORT=3001
    ports:
      - "3001:3001"
    networks:
      - panacea-network

  app-east:
    build: .
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - DATABASE_READ_REPLICA=${DATABASE_READ_REPLICA_US_EAST}
      - AWS_REGION=us-east-1
      - PORT=3001
    ports:
      - "3002:3001"
    networks:
      - panacea-network

  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
    depends_on:
      - app-west
      - app-east
    networks:
      - panacea-network

networks:
  panacea-network:
    driver: bridge
```

## Monitoring and Maintenance

### 1. Connection Pool Monitoring

Add metrics to track replica lag:

```typescript
import { prismaRead, prismaWrite } from './lib/prisma';

export async function getReplicationLag(): Promise<number> {
  try {
    // Query primary
    const primary = await prismaWrite.$queryRaw<[{ lsn: string }]>`
      SELECT pg_current_wal_lsn() as lsn;
    `;
    
    // Query replica
    const replica = await prismaRead.$queryRaw<[{ lsn: string }]>`
      SELECT pg_last_wal_receive_lsn() as lsn;
    `;
    
    // Calculate lag (simplified - use proper LSN comparison in production)
    return 0; // Return lag in bytes or milliseconds
  } catch (error) {
    console.error('Failed to calculate replication lag:', error);
    return -1;
  }
}
```

### 2. Health Checks

Add health check endpoint:

```typescript
app.get('/health', async (req, res) => {
  try {
    // Check primary database
    await prismaWrite.$queryRaw`SELECT 1`;
    
    // Check read replica
    await prismaRead.$queryRaw`SELECT 1`;
    
    // Check replication lag
    const lag = await getReplicationLag();
    
    res.json({
      status: 'healthy',
      database: {
        primary: 'connected',
        replica: 'connected',
        replicationLag: lag,
      },
      region: process.env.AWS_REGION,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
```

## Performance Optimization

### 1. Connection Pooling

Configure appropriate pool sizes:

```typescript
export const prismaWrite = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
  // Connection pool configuration
  connection: {
    pool: {
      max: 10, // Maximum connections
      min: 2,  // Minimum connections
      idle: 10000, // Idle timeout (ms)
    },
  },
});
```

### 2. Query Optimization

Use database-specific optimizations:

```typescript
// Prefer read replicas for expensive queries
const stats = await prismaRead.performanceRecord.groupBy({
  by: ['system'],
  _count: true,
  _avg: {
    isCorrect: true,
  },
});
```

## Failover Strategy

### Automatic Failover

If a read replica fails, fall back to primary:

```typescript
export async function getWithFailover<T>(
  query: () => Promise<T>
): Promise<T> {
  try {
    return await query();
  } catch (error) {
    console.warn('Read replica failed, falling back to primary');
    // Retry on primary
    return await query();
  }
}
```

### Circuit Breaker Pattern

Implement circuit breaker to prevent cascading failures:

```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime = 0;
  private readonly threshold = 5;
  private readonly timeout = 60000; // 1 minute

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error('Circuit breaker is open');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.failures >= this.threshold) {
      const elapsed = Date.now() - this.lastFailTime;
      return elapsed < this.timeout;
    }
    return false;
  }

  private onSuccess(): void {
    this.failures = 0;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailTime = Date.now();
  }
}
```

## Cost Considerations

### Estimate Monthly Costs

- **Primary Database**: $50-200/month (depending on size)
- **Read Replicas**: $25-100/month per region
- **EC2 Instances**: $30-100/month per instance
- **Load Balancer**: $20-50/month
- **Data Transfer**: $10-50/month

**Total Estimated Cost**: $165-700/month for 2-region deployment

### Cost Optimization Tips

1. **Use smaller instances initially**: Start with t3.small, scale up as needed
2. **Reserved instances**: Save 30-60% with 1-year commitments
3. **Use managed database services**: Neon, Supabase provide built-in replication
4. **Implement caching**: Reduce database load with Redis/CloudFlare cache

## Testing

### Load Testing Script

```bash
#!/bin/bash

# Test West region
echo "Testing US-WEST..."
ab -n 1000 -c 10 https://api-west.panacea.app/health

# Test East region
echo "Testing US-EAST..."
ab -n 1000 -c 10 https://api-east.panacea.app/health

# Test geographic routing
echo "Testing routing..."
curl -H "CF-IPCountry: US-CA" https://api.panacea.app/health
curl -H "CF-IPCountry: US-NY" https://api.panacea.app/health
```

## Rollout Plan

1. **Phase 1 (Week 1)**: Set up read replica in primary region
2. **Phase 2 (Week 2)**: Deploy application servers in second region
3. **Phase 3 (Week 3)**: Set up geographic routing
4. **Phase 4 (Week 4)**: Monitor and optimize
5. **Phase 5 (Week 5)**: Full cutover with monitoring

## Troubleshooting

### Common Issues

**Issue**: High replication lag
- **Solution**: Check network latency, increase WAL segments, optimize queries

**Issue**: Connection pool exhaustion
- **Solution**: Increase pool size, implement connection retry logic

**Issue**: Geographic routing not working
- **Solution**: Verify DNS propagation, check Route 53 configuration

## References

- [PostgreSQL Streaming Replication](https://www.postgresql.org/docs/current/warm-standby.html)
- [Neon Branching and Read Replicas](https://neon.tech/docs/introduction/read-replicas)
- [AWS Route 53 Geolocation Routing](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html)
- [Prisma Connection Pooling](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)

## Next Steps

- [ ] Set up primary database with logical replication
- [ ] Create read replicas in target regions
- [ ] Deploy application servers in multiple regions
- [ ] Configure geographic routing
- [ ] Set up monitoring and alerting
- [ ] Perform load testing
- [ ] Document runbooks for common scenarios
