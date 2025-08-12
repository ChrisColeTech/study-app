# V2 Parsing Requirements

## Format Detection Patterns

### SurePassExam Format (CLF-C02, SAP-C02)
```python
QUESTION_PATTERN = re.compile(r'NEW QUESTION\s+(\d+)\s*-\s*\((?:Exam\s+)?Topic\s+(\d+)\)', re.IGNORECASE)
ANSWER_PATTERN = re.compile(r'Answer:\s*([A-E](?:\s*,\s*[A-E])*)', re.IGNORECASE)
EXPLANATION_PATTERN = re.compile(r'Explanation:\s*(.*?)(?=NEW QUESTION|\Z)', re.DOTALL)
```

### Numbered Format (AIF-C01 variants)
```python
QUESTION_PATTERN = re.compile(r'^(\d+)\.\s+(.*?)(?=^\d+\.|$)', re.MULTILINE | re.DOTALL)
OPTION_PATTERN = re.compile(r'^([A-E])\.\s+(.+?)(?=^[A-E]\.|$)', re.MULTILINE)
```

### Standard Format (Fallback)
```python
QUESTION_PATTERN = re.compile(r'Question\s+(\d+)[:,]?\s*(.*?)', re.IGNORECASE)
# Use V1 patterns for options and answers
```

## Answer Extraction from Integrated Content

### Multi-Pattern Answer Recognition
```python
ANSWER_PATTERNS = [
    r'Answer:\s*([A-E](?:\s*,\s*[A-E])*)',
    r'Correct\s+Answer:\s*([A-E](?:\s*,\s*[A-E])*)',
    r'Solution:\s*([A-E](?:\s*,\s*[A-E])*)',
]
```

### Content Segmentation
- Segment by question boundaries (format-specific)
- Extract options within each question block
- Identify answer declarations within segments
- Parse explanations following answer patterns

## Answer Validation and Mapping

### Critical Challenge: Letter to Index Mapping
Extracted answers like "Answer: C" must be converted to option indices for mobile app compatibility.

#### Answer Processing Pipeline
```python
def process_extracted_answer(answer_text: str, question_options: list) -> dict:
    """Convert extracted answer to validated option indices."""
    
    # Step 1: Extract answer letter(s)
    letters = extract_answer_letters(answer_text)  # "Answer: A, C" → ['A', 'C']
    
    # Step 2: Map letters to indices
    indices = [ord(letter) - ord('A') for letter in letters]  # ['A', 'C'] → [0, 2]
    
    # Step 3: Validate mapping
    validation = validate_answer_mapping(indices, question_options, answer_text)
    
    return {
        'correct_answers': indices,
        'validation_confidence': validation.confidence,
        'mapping_issues': validation.issues
    }
```

#### Answer Letter Extraction
```python
ANSWER_LETTER_PATTERNS = [
    r'Answer:\s*([A-E](?:\s*,\s*[A-E])*)',           # "Answer: C" or "Answer: A, C"
    r'Correct\s+Answer:\s*([A-E](?:\s*,\s*[A-E])*)',  # "Correct Answer: C"
    r'Solution:\s*([A-E](?:\s*,\s*[A-E])*)',          # "Solution: C"
    r'([A-E])\s+is\s+correct',                        # "C is correct"
    r'The\s+answer\s+is\s+([A-E])',                   # "The answer is C"
]

def extract_answer_letters(answer_text: str) -> list:
    """Extract answer letters with multiple pattern fallback."""
    for pattern in ANSWER_LETTER_PATTERNS:
        match = re.search(pattern, answer_text, re.IGNORECASE)
        if match:
            letters_str = match.group(1)
            return re.findall(r'[A-E]', letters_str.upper())
    
    return []  # No letters found - flag for manual review
```

#### Answer Validation Strategy
```python
def validate_answer_mapping(indices: list, options: list, raw_answer: str) -> dict:
    """Validate that extracted indices match actual answer content."""
    
    issues = []
    confidence = 1.0
    
    # Check index bounds
    for idx in indices:
        if idx >= len(options):
            issues.append(f"Index {idx} exceeds option count {len(options)}")
            confidence *= 0.3
    
    # Text similarity validation
    if indices:
        selected_options = [options[i][1] for i in indices if i < len(options)]
        similarity = calculate_text_similarity(raw_answer, selected_options)
        confidence *= similarity
        
        if similarity < 0.5:
            issues.append("Low similarity between extracted answer and selected options")
    
    return {
        'confidence': confidence,
        'issues': issues,
        'validation_method': 'letter_mapping' if indices else 'failed_extraction'
    }
```

### Fallback Strategies for Missing Letters

#### Text-Based Answer Matching
```python
def fuzzy_match_answer_text(answer_text: str, options: list) -> dict:
    """When letter extraction fails, match answer text directly to options."""
    
    from difflib import SequenceMatcher
    
    best_matches = []
    
    for idx, (letter, option_text) in enumerate(options):
        # Calculate similarity between answer text and option text
        similarity = SequenceMatcher(None, answer_text.lower(), option_text.lower()).ratio()
        
        if similarity > 0.6:  # Threshold for reasonable match
            best_matches.append({
                'index': idx,
                'similarity': similarity,
                'option_text': option_text
            })
    
    # Sort by similarity, return best match(es)
    best_matches.sort(key=lambda x: x['similarity'], reverse=True)
    
    if best_matches:
        return {
            'correct_answers': [match['index'] for match in best_matches[:2]],  # Top 2 matches
            'validation_confidence': best_matches[0]['similarity'],
            'mapping_method': 'fuzzy_text_match'
        }
    
    return {
        'correct_answers': [],
        'validation_confidence': 0.0,
        'mapping_method': 'no_match_found'
    }
```

#### Explanation-Based Answer Inference
```python
def infer_from_explanation(explanation: str, options: list) -> dict:
    """Use explanation text to infer correct answer when direct extraction fails."""
    
    # Look for AWS service names, features, or specific terms in explanation
    explanation_lower = explanation.lower()
    
    matches = []
    for idx, (letter, option_text) in enumerate(options):
        option_keywords = extract_keywords(option_text)
        
        # Count keyword matches between explanation and option
        keyword_matches = sum(1 for keyword in option_keywords if keyword.lower() in explanation_lower)
        
        if keyword_matches > 0:
            matches.append({
                'index': idx,
                'keyword_matches': keyword_matches,
                'option_text': option_text
            })
    
    if matches:
        # Sort by keyword matches, return best
        matches.sort(key=lambda x: x['keyword_matches'], reverse=True)
        return {
            'correct_answers': [matches[0]['index']],
            'validation_confidence': min(matches[0]['keyword_matches'] / 5, 1.0),
            'mapping_method': 'explanation_inference'
        }
    
    return {
        'correct_answers': [],
        'validation_confidence': 0.0,
        'mapping_method': 'inference_failed'
    }
```

### Quality Control and Manual Review

#### Confidence-Based Review Flagging
```python
def flag_for_manual_review(answer_result: dict, threshold: float = 0.7) -> bool:
    """Flag low-confidence answers for manual review."""
    
    review_triggers = [
        answer_result['validation_confidence'] < threshold,
        len(answer_result.get('mapping_issues', [])) > 0,
        answer_result.get('mapping_method') in ['fuzzy_text_match', 'inference_failed'],
        len(answer_result.get('correct_answers', [])) == 0
    ]
    
    return any(review_triggers)
```

#### Manual Review Output Format
```python
def create_manual_review_item(question: dict, answer_result: dict) -> dict:
    """Create structured item for manual review queue."""
    
    return {
        'question_id': question['question_id'],
        'question_text': question['question_text'][:100] + '...',
        'extracted_answer_text': answer_result.get('raw_answer_text', ''),
        'options': question['options'],
        'proposed_indices': answer_result.get('correct_answers', []),
        'confidence': answer_result.get('validation_confidence', 0.0),
        'issues': answer_result.get('mapping_issues', []),
        'mapping_method': answer_result.get('mapping_method', 'unknown'),
        'requires_human_validation': True
    }
```

## Validation Requirements

- Question text minimum length: 20 characters
- Options count: 3-5 per question
- **Answer letter extraction**: >85% success rate using pattern matching
- **Index mapping validation**: >90% accuracy using similarity checking
- **Manual review threshold**: <15% of answers require human validation
- **Confidence scoring**: Combines letter extraction + text similarity + explanation matching