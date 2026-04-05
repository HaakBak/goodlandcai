const fs = require('fs');
const path = require('path');
function inspect(fname) {
  const text = fs.readFileSync(path.join(__dirname, '..', fname), 'utf8');
  const lines = text.split(/\r?\n/);
  console.log('FILE', fname);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === lines.length - 1 && line === '') continue;
    let cur = '';
    let inQuotes = false;
    const fields = [];
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (inQuotes && line[j + 1] === '"') {
          cur += '"';
          j++;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }
      if (c === ',' && !inQuotes) {
        fields.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    fields.push(cur);
    console.log(i + 1, fields.length, fields.slice(0, 5), fields[fields.length - 1]);
  }
  console.log();
}
inspect('data/menu.csv');
inspect('data/recipes.csv');
