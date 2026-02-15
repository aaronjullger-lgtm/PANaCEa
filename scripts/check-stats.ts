import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? '';
const supabaseKey =
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY) ?? '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function getStats() {
  const { count: totalAssets } = await supabase
    .from('MediaAsset')
    .select('*', { count: 'exact', head: true });

  const { count: analyzedAssets } = await supabase
    .from('MediaAsset')
    .select('*', { count: 'exact', head: true })
    .not('aiAnalysis', 'is', null);

  const { data: assets } = await supabase.from('MediaAsset').select('qualityRating');

  const qualityCounts: Record<string, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    none: 0,
  };
  assets?.forEach((a) => {
    const rating = a?.qualityRating;
    if (rating && rating in qualityCounts) qualityCounts[rating]++;
    else qualityCounts.none++;
  });

  const { data: conditionsWithImages } = await supabase
    .from('MediaAsset')
    .select('conditionId')
    .not('conditionId', 'is', null);

  const uniqueConditions = new Set(conditionsWithImages?.map((c) => c.conditionId));

  console.log('📊 MediaAsset Statistics:');
  console.log('  Total assets:', totalAssets);
  console.log('  With AI analysis:', analyzedAssets);
  console.log(
    '  Quality: excellent=' +
      qualityCounts.excellent +
      ', good=' +
      qualityCounts.good +
      ', fair=' +
      qualityCounts.fair +
      ', poor=' +
      qualityCounts.poor
  );
  console.log('  Conditions with images:', uniqueConditions.size);
}

getStats().catch(console.error);
