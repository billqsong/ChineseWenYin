import { validateCoverDictionary } from '../src/cover/coverEncoder';

const issues = await validateCoverDictionary();

if (issues.length > 0) {
  console.error('Dictionary validation failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('Dictionary validation passed.');
