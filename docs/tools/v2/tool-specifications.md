# V2 Tool Specifications

## Overview of Tools to be Created

Based on analysis of the new PDF formats, we'll create 5 core V2 tools that work together to transform PDFs with integrated answers into study datasets.

## 1. V2 PDF Parser Tool (`tools/v2_pdf_parser.py`)

### Purpose
Extract structured question data from multiple AWS certification PDF formats.

### Key Features
```python
class V2PDFParser:
    def detect_pdf_format(self, pdf_path: str) -> str
    def extract_questions(self, pdf_path: str) -> dict
    def parse_surepassexam_format(self, content: str, page_num: int) -> list
    def parse_numbered_format(self, content: str, page_num: int) -> list
    def parse_standard_format(self, content: str, page_num: int) -> list
    def extract_answer_options(self, content: str) -> list
    def detect_question_type(self, question: str) -> tuple
    def validate_question_structure(self, question: dict) -> bool
```

### What It Does
1. **Opens PDF** using pdfplumber
2. **Detects Format** using patterns:
   - SurePassExam: `NEW QUESTION\s+(\d+)\s*-\s*\((?:Exam\s+)?Topic\s+(\d+)\)`
   - Numbered: `^(\d+)\.\s+(.*?)(?=^\d+\.|$)`
   - Standard: `Question\s+(\d+)[:,]?\s*(.*?)`
3. **Routes to Format Parser** based on detection
4. **Extracts Questions** using format-specific patterns
5. **Parses Answer Options** using: `^([A-E])\.\s+(.+?)(?=^[A-E]\.|$)`
6. **Detects Question Types** (single_choice, multiple_choice_2, etc.)
7. **Validates Structure** and calculates confidence
8. **Outputs JSON** identical to V1 format

### Sample Output
```json
{
  "metadata": {
    "total_questions": 120,
    "total_topics": 5,
    "extraction_success_rate": 0.95,
    "pdf_format": "surepassexam",
    "failed_pages": []
  },
  "questions": [
    {
      "topic_number": 3,
      "question_number": 1,
      "question_id": "t3_q1",
      "question_text": "A company plans to migrate to the AWS Cloud...",
      "question_type": "single_choice",
      "select_count": 1,
      "options": [
        ["A", "AWS DataSync"],
        ["B", "AWS Application Migration Service"],
        ["C", "AWS Application Discovery Service"],
        ["D", "AWS Migration Hub"]
      ],
      "page_number": 2,
      "extraction_confidence": 0.94
    }
  ]
}
```

## 2. V2 Answer Parser Tool (`tools/v2_answer_parser.py`)

### Purpose
Extract correct answers and explanations from the same PDF content (not separate file).

### Key Features
```python
class V2AnswerParser:
    def parse_answers(self, pdf_path: str) -> dict
    def segment_by_questions(self, content: str, format_type: str) -> list
    def extract_surepassexam_answers(self, segment: str) -> dict
    def extract_numbered_answers(self, segment: str) -> dict
    def extract_standard_answers(self, segment: str) -> dict
    def parse_explanations(self, segment: str, format_type: str) -> str
    def clean_and_normalize(self, text: str) -> str
    # Critical validation methods
    def extract_answer_letters(self, answer_text: str) -> list
    def map_letters_to_indices(self, letters: list) -> list
    def validate_answer_mapping(self, indices: list, options: list, raw_answer: str) -> dict
    def fuzzy_match_answer_text(self, answer_text: str, options: list) -> dict
    def flag_for_manual_review(self, answer_result: dict) -> bool
```

### Multi-Format Answer Support
1. **SurePassExam Parser**: `Answer:\s*([A-E](?:\s*,\s*[A-E])*)`
2. **Numbered Parser**: `(?:Answer|Correct Answer|Solution):\s*([A-E](?:\s*,\s*[A-E])*)`
3. **Standard Parser**: Same patterns as V1 adapted for integrated content
4. **Explanation Parser**: `Explanation:\s*(.*?)(?=NEW QUESTION|\Z)`

### What It Does
1. **Opens Same PDF** as used by V2 PDF Parser
2. **Detects Format** (same detection as PDF parser)
3. **Segments Content** by question boundaries (format-specific)
4. **Extracts Answer Letters** using multiple patterns ("Answer: C" → "C")
5. **Maps Letters to Indices** (C → index 2 in zero-based array)
6. **Validates Mapping** by comparing answer text to actual option text
7. **Applies Fallback Strategies** when letter extraction fails (fuzzy matching, explanation inference)
8. **Flags Low Confidence** answers for manual review
9. **Parses Explanations** following answer declarations
10. **Outputs JSON** with validated answer indices

### Sample Output
```json
{
  "metadata": {
    "total_answers": 120,
    "parsing_success_rate": 0.92,
    "format_distribution": {
      "answer_format": 118,
      "explanation_format": 95
    }
  },
  "answers": [
    {
      "answer_number": 1,
      "question_preview": "A company plans to migrate to the AWS Cloud...",
      "extracted_letters": ["C"],
      "correct_answer_indices": [2],
      "correct_answer_text": "AWS Application Discovery Service",
      "answer_format": "Answer:",
      "explanation": "AWS Application Discovery Service helps enterprises plan migration projects...",
      "keywords": ["Application Discovery Service", "migration"],
      "validation_confidence": 0.94,
      "mapping_method": "letter_mapping",
      "requires_manual_review": false,
      "mapping_issues": []
    }
  ]
}
```

## 3. V2 Question Classifier Tool (`tools/v2_classify_questions.py`)

### Purpose
Classify questions into logical topics (identical to V1).

### Key Features
```python
class V2QuestionClassifier:
    # Same class structure as V1 classify_questions.py
```

### What It Does (Identical to V1)
1. **Loads Questions** from V2 PDF parser output
2. **Classifies by AWS Services** using same keyword detection
3. **Groups into Topics** using same logic as V1
4. **Outputs JSON** identical to V1 format

### No Changes Required
Copy `tools/classify_questions.py` exactly - same classification logic works for all question formats.

## 4. V2 Enhanced Answer Parser Tool (`tools/v2_enhance_answer_patterns.py`)

### Purpose
Handle edge cases and alternative answer formats missed by the main V2 answer parser.

### Key Features
```python
class V2EnhancedAnswerParser:
    def enhance_answers(self, pdf_path: str, main_answers: dict) -> dict
    def find_missing_answers(self, content: str, answered_questions: set) -> list
    def try_alternative_patterns(self, segment: str) -> dict
    def extract_embedded_answers(self, question_text: str) -> dict
    def validate_enhanced_answers(self, enhanced: dict, original: dict) -> dict
```

### Enhanced Pattern Support
1. **Relaxed Answer Patterns**: `([A-E])\s+is\s+correct`
2. **Embedded Patterns**: Answer hints within question text
3. **Alternative Markers**: `Solution:`, `Correct:`, `Right answer:`
4. **Context Clues**: AWS service names matching answer options

### What It Does
1. **Identifies Missing Answers** from main parser results
2. **Applies Relaxed Patterns** to difficult segments
3. **Searches for Embedded Clues** in question text
4. **Cross-References** answer options with explanation content
5. **Validates Enhanced Results** against original parser
6. **Outputs JSON** with additional answers found

## 5. V2 Aggressive Parser Tool (`tools/v2_aggressive_parser.py`)

### Purpose
Final attempt at extracting answers using very relaxed parsing rules.

### Key Features
```python
class V2AggressiveParser:
    def aggressive_parse(self, pdf_path: str, previous_results: dict) -> dict
    def try_all_patterns(self, segment: str) -> dict
    def infer_from_context(self, question: dict, explanation: str) -> list
    def match_by_keywords(self, question: dict, explanation: str) -> list
    def score_confidence(self, question: dict, inferred_answer: str) -> float
```

### Aggressive Strategy
1. **Keyword Matching**: Match AWS services in questions to answer options
2. **Explanation Mining**: Extract answer clues from explanation text
3. **Pattern Relaxation**: Try all possible answer patterns with loose matching
4. **Context Inference**: Use surrounding content to infer correct answers

### What It Does
1. **Processes Remaining Questions** not answered by main or enhanced parsers
2. **Applies All Known Patterns** with relaxed matching
3. **Infers Answers** from explanation content and keywords
4. **Scores Confidence** for each inferred answer
5. **Flags Low Confidence** items for manual review
6. **Outputs JSON** with aggressive parsing results

## 6. V2 Data Combiner Tool (`tools/v2_data_combiner.py`)

### Purpose
Combine multiple answer sources into final study dataset (identical logic to V1).

### Key Features
```python
class V2DataCombiner:
    def combine_data(self, questions_file: str, enhanced_file: str, aggressive_file: str, output_file: str) -> dict
    def merge_answer_sources(self, enhanced_answers: list, aggressive_answers: list) -> dict
    def match_questions_answers(self, questions: list, answers: dict) -> list
    def create_study_pair(self, question: dict, answer: dict) -> dict
    def assess_difficulty(self, question: dict, answer: dict) -> str
    def create_final_dataset(self, study_pairs: list, metadata: dict) -> dict
```

### What It Does (Identical to V1)
1. **Loads All Sources**: questions.json + enhanced.json + aggressive.json
2. **Merges Answer Sources**: prioritize enhanced, fallback to aggressive
3. **Matches Questions to Answers**: by question number
4. **Creates Study Pairs**: complete question-answer combinations
5. **Calculates Quality Metrics**: difficulty, confidence, completeness
6. **Generates Final Dataset**: identical format to study_data_complete.json

### Sample Output (Identical to V1)
```json
{
  "metadata": {
    "dataset_version": "2.0",
    "creation_date": "2024-01-15T12:00:00Z",
    "total_questions": 118,
    "total_topics": 5,
    "question_types": {
      "single_choice": 108,
      "multiple_choice_2": 8,
      "multiple_choice_3": 2
    }
  },
  "topics": [
    {
      "topic_id": 3,
      "topic_name": "Topic 3 - Migration & Transfer", 
      "question_count": 25,
      "questions": [
        {
          "question_id": "t3_q1",
          "question_text": "A company plans to migrate to the AWS Cloud...",
          "question_type": "single_choice",
          "select_count": 1,
          "options": ["AWS DataSync", "AWS Application Migration Service", "AWS Application Discovery Service", "AWS Migration Hub"],
          "correct_answers": [2],
          "explanation": "AWS Application Discovery Service helps enterprises plan migration projects...",
          "keywords": ["Application Discovery Service", "migration"],
          "difficulty": "medium"
        }
      ]
    }
  ]
}
```

## Command Line Usage

Each tool has a simple command line interface:

```bash
# Parse PDF questions with format detection
python tools/v2_pdf_parser.py --input docs/exam-material/clf-c02_2.pdf --output data/v2/clf-c02_2_questions.json

# Classify questions into topics
python tools/v2_classify_questions.py --input data/v2/clf-c02_2_questions.json --output data/v2/clf-c02_2_classified.json

# Parse answers from same PDF
python tools/v2_answer_parser.py --input docs/exam-material/clf-c02_2.pdf --output data/v2/clf-c02_2_answers_raw.json

# Enhanced answer extraction
python tools/v2_enhance_answer_patterns.py --input docs/exam-material/clf-c02_2.pdf --baseline data/v2/clf-c02_2_answers_raw.json --output data/v2/clf-c02_2_answers_enhanced.json

# Aggressive parsing fallback
python tools/v2_aggressive_parser.py --input docs/exam-material/clf-c02_2.pdf --previous data/v2/clf-c02_2_answers_enhanced.json --output data/v2/clf-c02_2_answers_aggressive.json

# Combine into final dataset
python tools/v2_data_combiner.py --questions data/v2/clf-c02_2_classified.json --enhanced data/v2/clf-c02_2_answers_enhanced.json --aggressive data/v2/clf-c02_2_answers_aggressive.json --output data/clf-c02_2_study_data.json
```

These 6 tools work together following the exact same proven V1 architecture: PDF Parser → Classifier → Answer Parser → Enhancer → Aggressive → Data Combiner.