# Data Structure Design

## Final Study Data Format
```json
{
  "metadata": {
    "total_questions": 500,
    "total_topics": 10,
    "parsing_date": "2024-01-01",
    "source_files": ["AWS SAA-C03.pdf", "AWS SAA-03 Solution.txt"]
  },
  "topics": [
    {
      "topic_id": 1,
      "topic_name": "Topic 1",
      "question_count": 50,
      "questions": [
        {
          "question_id": "t1_q1",
          "original_number": 1,
          "topic_number": 1,
          "question_text": "A company collects data for temperature...",
          "question_type": "single_choice", // "multiple_choice_2", "multiple_choice_3", "select_all"
          "select_count": 1, // number of correct answers to select
          "options": [
            "Turn on S3 Transfer Acceleration on the destination S3 bucket",
            "Upload the data from each site to an Amazon EC2 instance",
            "Schedule AWS Snowball Edge devices",
            "Upload the data from each site to different S3 buckets"
          ],
          "correct_answers": [0], // indices of correct options
          "explanation": "S3 Transfer Acceleration uses Edge Locations...",
          "keywords": ["S3", "Transfer Acceleration", "multi-continent"],
          "difficulty": "medium",
          "matched": true, // indicates successful question-answer matching
          "confidence": 0.95 // matching confidence score
        }
      ]
    }
  ]
}
```

## Intermediate Data Formats

### Raw Questions (from PDF)
```json
{
  "questions": [
    {
      "topic_number": 1,
      "question_number": 1,
      "raw_text": "Topic 1 Question #1\nA company collects data...",
      "question_text": "A company collects data for temperature...",
      "options": [["A", "Turn on S3 Transfer Acceleration..."], ["B", "Upload data..."]],
      "question_type": "single_choice",
      "select_count": 1,
      "page_number": 15
    }
  ]
}
```

### Raw Answers (from Text)
```json
{
  "answers": [
    {
      "answer_number": 1,
      "question_preview": "A company collects data for temperature...",
      "correct_answer": "Turn on S3 Transfer Acceleration on the destination S3 bucket",
      "answer_format": "ans-", // "letter", "hybrid"
      "explanation": "S3 Transfer Acceleration because: ideally works...",
      "raw_text": "1] A company collects data...ans- Turn on S3..."
    }
  ]
}
```

## Processing Pipeline
1. **PDF → Raw Questions**: Extract structured question data
2. **Text → Raw Answers**: Parse multiple answer formats
3. **Matcher → Validation**: Match questions to answers with confidence scoring
4. **Combiner → Final Dataset**: Create study-ready JSON structure
5. **App → Interactive Quiz**: Load and present questions

## File Outputs
- `data/questions_raw.json` - Parsed questions from PDF (intermediate)
- `data/answers_raw.json` - Parsed answers from text (intermediate)
- `data/matching_report.json` - Validation results and statistics
- `data/study_data.json` - Final combined dataset (production)
- `logs/parsing_log.txt` - Processing status and errors
- `logs/unmatched_items.json` - Items requiring manual review