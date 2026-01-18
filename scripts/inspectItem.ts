import fs from 'fs';
import path from 'path';

const contentPath = path.resolve('conditionContent.generated.json');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

const targetId = 'CV__heart_failure__highoutput_heart_failure';
const item = content.find((i: any) => i.conditionId === targetId);

if (item) {
  console.log('Etiology:', JSON.stringify(item.content.etiologyPathophysiology, null, 2));
} else {
  console.log('Item not found');
}
