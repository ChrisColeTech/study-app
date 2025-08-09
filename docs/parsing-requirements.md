# Parsing Requirements

## PDF Parser Requirements

### Core Functionality
- **Question Detection**: Regex `Topic\s+(\d+)\s+Question\s+#(\d+)`
- **Section Boundaries**: Group by topic numbers (1-10+)
- **Question Types**: 
  - Single: Default behavior
  - Multiple (2): "Choose two" detection
  - Multiple (3): "Choose three" detection  
  - Select All: "Select all that apply" detection
- **Answer Options**: Regex `^([A-E])\.\s+(.+?)(?=^[A-E]\.|$)`
- **Multi-line Handling**: DOTALL flag for spanning content
- **Error Recovery**: Graceful handling of PDF extraction failures

### Quality Assurance
- Validate sequential question numbering
- Ensure 4-5 answer choices per question
- Log extraction failures with page numbers
- Export problematic questions for manual review

## Answer Parser Requirements

### Multi-Format Support
1. **Primary Format**: `ans-\s*(.+?)(?=\n\n|\n[A-Z]|$)`
2. **Letter Format**: `^([A-E])\.\s*(.+?)(?=\n\n|$)`
3. **Hybrid Format**: `^([A-E])\s+(.+?)(?=\n\n|$)`
4. **Fallback**: Manual parsing for edge cases

### Processing Logic
- **Question Segmentation**: Split by `(\d+)\]` pattern
- **Answer Extraction**: Try multiple parsers in sequence
- **Content Cleaning**: Remove separators, normalize whitespace
- **Explanation Extraction**: Capture technical details and keywords
- **Validation**: Check answer format and content length

### Error Handling
- Log unrecognized answer formats
- Flag questions with multiple answer interpretations
- Export unparseable content for manual review

## Validation & Matching Requirements

### Question-Answer Matching
- **Primary Key**: Sequential numbering (PDF Q#1 → Answer 1])
- **Validation**: Content similarity scoring using text overlap
- **Confidence Scoring**: 0-1 scale based on text match quality
- **Threshold**: Minimum 0.7 confidence for auto-matching

### Quality Checks
- **Completeness**: Verify all questions have answers
- **Consistency**: Check answer option counts (A-D/E)
- **Accuracy**: Validate correct answer indices exist
- **Duplicates**: Identify repeated questions or answers
- **Orphans**: Find questions without matching answers

### Reporting
- **Success Metrics**: Parsing and matching success rates
- **Error Catalog**: Categorized parsing failures
- **Manual Review**: Export items requiring human validation
- **Statistics**: Question type distribution, topic breakdown

## Input File Analysis Results

### PDF Analysis (AWS SAA-C03)
✅ **Structure**: Highly consistent "Topic X Question #Y" format
✅ **Questions**: 500+ questions across 249 pages
✅ **Success Rate**: ~98% (4 pages with extraction issues)
✅ **Question Types**: Single choice, "Choose two/three", "Select all"
✅ **Options**: Mostly A-D, some A-E

### Answer File Analysis (AWS SAA-03 Solution.txt)
✅ **Size**: 588KB with detailed explanations
✅ **Format**: Mixed - "ans-", "A.", "B", etc.
✅ **Numbering**: Sequential 1], 2], 3]...
⚠️  **Challenge**: Inconsistent formatting requires multiple parsers

## Technical Implementation Specifications