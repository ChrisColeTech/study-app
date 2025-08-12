# V2 Data Flow and Storage

## Processing Pipeline Data Storage

### Input Files
```
docs/exam-material/
├── clf-c02_2.pdf          # Input PDF
├── clf-c02_6.pdf          # Input PDF  
├── sap-c02_6.pdf          # Input PDF
├── sap-c02_7.pdf          # Input PDF
├── sap-c02_8.pdf          # Input PDF
├── aif-c01_3.pdf          # Input PDF
└── aif-c01_6.pdf          # Input PDF
```

### Intermediate Processing Files (Per PDF)

#### Example: Processing clf-c02_2.pdf
```
data/v2/
├── clf-c02_2_questions_raw.json           # Step 1: PDF Parser output
├── clf-c02_2_questions_classified.json    # Step 2: Classifier output  
├── clf-c02_2_answers_raw.json             # Step 3: Answer Parser output
├── clf-c02_2_answers_enhanced.json        # Step 4: Enhanced Parser output
└── clf-c02_2_answers_aggressive.json      # Step 5: Aggressive Parser output
```

### Final Study Dataset Files
```
data/
├── clf-c02_2_study_data.json             # Step 6: Final dataset for CLF-C02 Set 2
├── clf-c02_6_study_data.json             # Step 6: Final dataset for CLF-C02 Set 6
├── sap-c02_6_study_data.json             # Step 6: Final dataset for SAP-C02 Set 6
├── sap-c02_7_study_data.json             # Step 6: Final dataset for SAP-C02 Set 7
├── sap-c02_8_study_data.json             # Step 6: Final dataset for SAP-C02 Set 8
├── aif-c01_3_study_data.json             # Step 6: Final dataset for AIF-C01 Set 3
└── aif-c01_6_study_data.json             # Step 6: Final dataset for AIF-C01 Set 6
```

### Processing Logs
```
logs/
├── v2_pdf_parser_20240115_143022.log
├── v2_answer_parser_20240115_143045.log
├── v2_enhance_answer_patterns_20240115_143112.log
├── v2_aggressive_parser_20240115_143140.log
└── v2_data_combiner_20240115_143205.log
```

## Complete Processing Example

### Processing clf-c02_2.pdf
```bash
# Step 1: Extract questions
python tools/v2_pdf_parser.py \
  --input docs/exam-material/clf-c02_2.pdf \
  --output data/v2/clf-c02_2_questions_raw.json

# Step 2: Classify questions into topics  
python tools/v2_classify_questions.py \
  --input data/v2/clf-c02_2_questions_raw.json \
  --output data/v2/clf-c02_2_questions_classified.json

# Step 3: Extract answers
python tools/v2_answer_parser.py \
  --input docs/exam-material/clf-c02_2.pdf \
  --output data/v2/clf-c02_2_answers_raw.json

# Step 4: Enhanced answer extraction
python tools/v2_enhance_answer_patterns.py \
  --input docs/exam-material/clf-c02_2.pdf \
  --baseline data/v2/clf-c02_2_answers_raw.json \
  --output data/v2/clf-c02_2_answers_enhanced.json

# Step 5: Aggressive answer extraction
python tools/v2_aggressive_parser.py \
  --input docs/exam-material/clf-c02_2.pdf \
  --previous data/v2/clf-c02_2_answers_enhanced.json \
  --output data/v2/clf-c02_2_answers_aggressive.json

# Step 6: Combine into final dataset
python tools/v2_data_combiner.py \
  --questions data/v2/clf-c02_2_questions_classified.json \
  --enhanced data/v2/clf-c02_2_answers_enhanced.json \
  --aggressive data/v2/clf-c02_2_answers_aggressive.json \
  --output data/clf-c02_2_study_data.json
```

## Mobile Application Integration

### Final Dataset Usage
```javascript
// Mobile app loads final study datasets
const examOptions = [
  {
    id: 'clf-c02-2',
    name: 'AWS Cloud Practitioner (Set 2)', 
    dataFile: require('./data/clf-c02_2_study_data.json')
  },
  {
    id: 'clf-c02-6',
    name: 'AWS Cloud Practitioner (Set 6)',
    dataFile: require('./data/clf-c02_6_study_data.json')
  },
  {
    id: 'sap-c02-6', 
    name: 'AWS Solutions Architect Pro (Set 6)',
    dataFile: require('./data/sap-c02_6_study_data.json')
  }
];
```

### Mobile App Data Directory
```
mobile-app/src/data/
├── clf-c02_2_study_data.json     # Copy from data/
├── clf-c02_6_study_data.json     # Copy from data/
├── sap-c02_6_study_data.json     # Copy from data/
├── sap-c02_7_study_data.json     # Copy from data/
├── sap-c02_8_study_data.json     # Copy from data/
├── aif-c01_3_study_data.json     # Copy from data/
└── aif-c01_6_study_data.json     # Copy from data/
```

## Quality Assurance Files

### Manual Review Queue
```
data/v2/manual_review/
├── clf-c02_2_review_queue.json           # Low confidence answers for manual review
├── clf-c02_2_validation_report.json     # Quality validation report
└── clf-c02_2_processing_summary.json    # Overall processing statistics
```

### Batch Processing Results
```
data/v2/batch_results/
├── processing_summary_20240115.json     # Overall batch processing results
├── quality_report_20240115.json         # Quality metrics across all PDFs
└── manual_review_consolidated.json      # All items needing manual review
```

## Data Retention Policy

### Keep Permanently
- **Final study datasets** (`data/*_study_data.json`) - Used by mobile app
- **Processing logs** - For debugging and quality assurance
- **Manual review items** - For continuous improvement

### Can Delete After Processing
- **Intermediate JSON files** (`data/v2/*`) - Only needed during development/debugging
- **Raw extracted content** - Can be regenerated if needed

### Backup Strategy
- **Critical**: Final study datasets (mobile app depends on these)
- **Important**: Processing logs and quality reports
- **Optional**: Intermediate processing files (can be regenerated)

## Directory Structure Summary
```
study-app/
├── docs/exam-material/           # Input PDFs (permanent)
├── data/
│   ├── v2/                      # Intermediate processing files (temporary)
│   │   ├── manual_review/       # Quality assurance files
│   │   └── batch_results/       # Batch processing summaries
│   └── *_study_data.json        # Final datasets (permanent - used by mobile app)
├── logs/                        # Processing logs (permanent)
├── tools/                       # V2 processing tools
└── mobile-app/src/data/         # Final datasets copied for mobile app
```