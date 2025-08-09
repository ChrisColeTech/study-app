# Tool Specifications

## Overview of Tools to be Created

Based on the analysis, we'll create 5 core tools that work together to transform your PDF and text files into a functional study application.

## 1. PDF Parser Tool (`tools/pdf_parser.py`)

### Purpose
Extract structured question data from the AWS SAA-C03 PDF file.

### Key Features
```python
class PDFParser:
    def extract_questions(self, pdf_path: str) -> dict
    def parse_question_text(self, raw_text: str) -> dict
    def detect_question_type(self, question: str) -> str
    def extract_answer_options(self, content: str) -> list
    def validate_question_structure(self, question: dict) -> bool
```

### What It Does
1. **Opens PDF** using pdfplumber (robust text extraction)
2. **Finds Questions** using regex: `Topic\s+(\d+)\s+Question\s+#(\d+)`
3. **Extracts Content** between question markers
4. **Parses Answer Options** using pattern: `^([A-E])\.\s+(.+?)(?=^[A-E]\.|$)`
5. **Detects Question Types**:
   - Single choice (default)
   - Multiple choice ("Choose two" → select 2)
   - Multiple choice ("Choose three" → select 3)
   - Select all ("Select all that apply")
6. **Validates Structure** (ensures 4-5 options, proper formatting)
7. **Outputs JSON** with structured question data

### Sample Output
```json
{
  "metadata": {
    "total_questions": 547,
    "total_topics": 10,
    "extraction_success_rate": 0.982,
    "failed_pages": [45, 127, 203, 241]
  },
  "questions": [
    {
      "topic_number": 1,
      "question_number": 1,
      "question_id": "t1_q1",
      "question_text": "A company collects data for temperature, humidity...",
      "question_type": "single_choice",
      "select_count": 1,
      "options": [
        ["A", "Turn on S3 Transfer Acceleration..."],
        ["B", "Upload the data from each site..."],
        ["C", "Schedule AWS Snowball Edge devices..."],
        ["D", "Upload the data from each site to different S3 buckets..."]
      ],
      "page_number": 15,
      "extraction_confidence": 0.95
    }
  ]
}
```

## 2. Answer Parser Tool (`tools/answer_parser.py`)

### Purpose
Extract correct answers and explanations from the non-standard text file.

### Key Features
```python
class AnswerParser:
    def parse_answers(self, text_path: str) -> dict
    def segment_by_questions(self, content: str) -> list
    def extract_answer_formats(self, segment: str) -> dict
    def parse_explanations(self, segment: str) -> str
    def clean_and_normalize(self, text: str) -> str
```

### Multi-Format Support
1. **Primary Parser**: `ans-\s*(.+?)(?=\n\n|\n[A-Z]|$)`
2. **Letter Parser**: `^([A-E])\.\s*(.+?)(?=\n\n|$)`
3. **Hybrid Parser**: `^([A-E])\s+(.+?)(?=\n\n|$)`
4. **Fallback Parser**: Manual extraction for edge cases

### What It Does
1. **Segments Text** by question numbers: `(\d+)\]`
2. **Tries Multiple Parsers** in sequence until one works
3. **Extracts Answers** using format-specific regex patterns
4. **Cleans Content** (removes separators, fixes encoding)
5. **Parses Explanations** (extracts technical details)
6. **Normalizes Format** (standardizes answer text)
7. **Logs Issues** (tracks unparseable content)

### Sample Output
```json
{
  "metadata": {
    "total_answers": 547,
    "parsing_success_rate": 0.94,
    "format_distribution": {
      "ans_format": 342,
      "letter_format": 198,
      "hybrid_format": 7
    }
  },
  "answers": [
    {
      "answer_number": 1,
      "question_preview": "A company collects data for temperature...",
      "correct_answer": "Turn on S3 Transfer Acceleration on the destination S3 bucket",
      "answer_format": "ans-",
      "explanation": "S3 Transfer Acceleration because: ideally works with objects for long-distance transfer...",
      "keywords": ["S3", "Transfer Acceleration", "Edge Locations"],
      "raw_text": "1] A company collects data...ans- Turn on S3...",
      "parsing_confidence": 0.89
    }
  ]
}
```

## 3. Question-Answer Matcher (`tools/matcher.py`)

### Purpose
Intelligently match questions from PDF to answers from text file.

### Key Features
```python
class QuestionMatcher:
    def match_questions_answers(self, questions: dict, answers: dict) -> dict
    def calculate_similarity(self, q_text: str, a_preview: str) -> float
    def validate_matches(self, matches: list) -> dict
    def generate_confidence_scores(self, match: dict) -> float
    def identify_orphans(self, questions: dict, answers: dict) -> dict
```

### Matching Algorithm
1. **Primary Matching**: Sequential numbering (Q#1 → Answer 1])
2. **Validation**: Text similarity using fuzzy string matching
3. **Confidence Scoring**: 0-1 scale based on content overlap
4. **Quality Checks**: Ensure answer options exist, detect duplicates

### What It Does
1. **Maps by Number**: Links PDF Question #N to Answer N]
2. **Validates Content**: Compares question text to answer preview
3. **Scores Confidence**: Rates match quality (0.7+ threshold)
4. **Identifies Issues**: Finds missing, duplicate, or mismatched items
5. **Generates Report**: Statistics on matching success rates
6. **Creates Final Dataset**: Combined question-answer pairs

### Sample Output
```json
{
  "metadata": {
    "total_matches": 523,
    "high_confidence": 498,
    "medium_confidence": 25,
    "failed_matches": 24,
    "match_success_rate": 0.956
  },
  "matched_questions": [
    {
      "question_id": "t1_q1",
      "answer_id": "a1",
      "match_confidence": 0.94,
      "validation_status": "verified"
    }
  ],
  "orphaned_questions": [12, 45, 78],
  "orphaned_answers": [13, 46, 79],
  "duplicate_detections": []
}
```

## 4. Data Combiner Tool (`tools/combiner.py`)

### Purpose
Merge matched questions and answers into final study-ready format.

### Key Features
```python
class DataCombiner:
    def combine_data(self, questions: dict, answers: dict, matches: dict) -> dict
    def structure_by_topics(self, combined: list) -> dict
    def add_metadata(self, dataset: dict) -> dict
    def validate_final_structure(self, data: dict) -> bool
    def export_study_format(self, data: dict, output_path: str) -> bool
```

### What It Does
1. **Merges Data**: Combines question + answer + explanation
2. **Groups by Topics**: Organizes questions by AWS service area
3. **Adds Metadata**: Includes parsing statistics and timestamps
4. **Validates Structure**: Ensures all required fields present
5. **Exports JSON**: Creates final study_data.json file

### Sample Output
```json
{
  "metadata": {
    "dataset_version": "1.0",
    "creation_date": "2024-01-01T12:00:00Z",
    "total_questions": 523,
    "total_topics": 10,
    "question_types": {
      "single_choice": 445,
      "multiple_choice_2": 65,
      "multiple_choice_3": 13
    }
  },
  "topics": [
    {
      "topic_id": 1,
      "topic_name": "Topic 1 - Storage Services",
      "question_count": 52,
      "questions": [
        {
          "question_id": "t1_q1",
          "question_text": "A company collects data...",
          "question_type": "single_choice",
          "select_count": 1,
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correct_answers": [0],
          "explanation": "S3 Transfer Acceleration...",
          "keywords": ["S3", "Transfer Acceleration"],
          "difficulty": "medium"
        }
      ]
    }
  ]
}
```

## 5. Mobile Study Application (`mobile-app/src/`)

### Purpose
Cross-platform React Native mobile application for taking practice exams.

### Key Components
```typescript
interface StudyApp {
  loadStudyData(): Promise<StudyData>
  getQuestionsByTopic(topicId: number): Question[]
  randomizeQuestions(questions: Question[]): Question[]
  checkAnswers(responses: UserResponse[]): QuizResult
  trackProgress(session: StudySession): void
}
```

### Application Structure
```
mobile-app/
├── src/
│   ├── screens/
│   │   ├── TopicSelection.tsx    # Topic selection screen
│   │   ├── Quiz.tsx              # Question interface
│   │   └── Results.tsx           # Score and explanations
│   ├── components/
│   │   ├── Question.tsx          # Individual question component
│   │   ├── AnswerChoice.tsx      # Answer option component
│   │   └── ProgressBar.tsx       # Progress indicator
│   ├── services/
│   │   ├── DataLoader.ts         # Load JSON data
│   │   ├── QuizEngine.ts         # Quiz logic
│   │   └── ProgressTracker.ts    # Progress persistence
│   └── data/
│       └── study_data.json       # Questions from Python tools
└── assets/
    ├── icons/                    # App icons
    └── images/                   # UI images
```

### Mobile Features
- **Offline Capability**: All questions stored locally
- **Topic Selection**: Choose which AWS service areas to study
- **Question Randomization**: Shuffles questions within topics
- **Multiple Question Types**: Single choice, multiple choice, select all
- **Progress Tracking**: Persistent local storage of results
- **Detailed Explanations**: Expandable answer explanations
- **Score Reporting**: Performance analytics and weak areas
- **Push Notifications**: Study reminders and streak tracking
- **Dark Mode**: Better for studying in low light
- **Haptic Feedback**: Tactile response to interactions

## 6. Supporting Tools

### Log Analyzer (`tools/log_analyzer.py`)
- Analyzes parsing logs for quality metrics
- Generates reports on extraction success rates
- Identifies patterns in parsing failures

### Validator Tool (`tools/validator.py`)
- Cross-validates question-answer pairs
- Checks for formatting consistency
- Exports items needing manual review

### Export Tool (`tools/exporter.py`)
- Exports data to different formats (CSV, JSON, SQLite)
- Creates backup datasets
- Generates study guides in text format

## Tool Integration Flow

```
PDF File → PDF Parser → questions_raw.json
                            ↓
Text File → Answer Parser → answers_raw.json
                            ↓
Both Files → Matcher → matching_report.json
                            ↓
All Data → Combiner → study_data.json
                            ↓
Study App → Interactive Quiz Interface
```

## Command Line Usage

Each tool will have a simple command line interface:

```bash
# Parse PDF questions
python tools/pdf_parser.py --input docs/exam-material/AWS\ SAA-C03.pdf --output data/questions_raw.json

# Parse text answers  
python tools/answer_parser.py --input docs/exam-material/AWS\ SAA-03\ Solution.txt --output data/answers_raw.json

# Match questions to answers
python tools/matcher.py --questions data/questions_raw.json --answers data/answers_raw.json --output data/matches.json

# Combine into final dataset
python tools/combiner.py --questions data/questions_raw.json --answers data/answers_raw.json --matches data/matches.json --output mobile-app/src/data/study_data.json

# Run mobile application
cd mobile-app && npx react-native run-android
cd mobile-app && npx react-native run-ios
```

These tools work together to transform your raw exam materials into a professional-quality study application with minimal manual intervention.