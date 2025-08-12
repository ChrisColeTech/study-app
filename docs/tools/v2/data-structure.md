# V2 Data Structure Specifications

## Overview

V2 tools process individual PDFs from exam-material folder using the same proven V1 multi-phase approach. Each PDF becomes its own study dataset using identical JSON structures to V1.

## New PDF Formats Supported

### Format 1: SurePassExam Standard
- **Files**: clf-c02_*.pdf, sap-c02_*.pdf
- **Question Pattern**: `NEW QUESTION (\d+) - ((?:Exam )?Topic (\d+))`
- **Answer Pattern**: `Answer: ([A-E])` followed by `Explanation: ...`

### Format 2: Numbered Questions
- **Files**: aif-c01_*.pdf (variants)
- **Question Pattern**: `^(\d+)\. (.*?)(?=^\d+\.|$)`
- **Answer Integration**: Mixed formats within question blocks

### Format 3: Standard Headers (Fallback)
- **Files**: Legacy formats
- **Question Pattern**: `Question (\d+)[:] (.*?)`
- **Processing**: Standard V1-style extraction

## Processing Pipeline

Each PDF follows V1 approach:
```
PDF → V2_PDF_Parser → questions.json
PDF → V2_Answer_Parser → answers_raw.json  
PDF → V2_Enhanced_Parser → answers_enhanced.json
PDF → V2_Aggressive_Parser → answers_aggressive.json
All → V2_Data_Combiner → final_study_data.json
```

## Output Format

Identical to V1 `study_data_complete.json`:
```json
{
  "metadata": {
    "dataset_version": "2.0",
    "total_questions": 120,
    "total_topics": 5
  },
  "topics": [
    {
      "topic_id": 1,
      "topic_name": "Topic 1 - Cloud Concepts",
      "questions": [
        {
          "question_id": "t1_q1",
          "question_text": "...",
          "options": ["A", "B", "C", "D"],
          "correct_answers": [2],
          "explanation": "..."
        }
      ]
    }
  ]
}
```

## Key Differences from V1

- **Input**: Single PDF with integrated answers (not separate PDF + text file)
- **Patterns**: Updated regex for new question/answer formats
- **Output**: Same JSON structure, individual files per PDF