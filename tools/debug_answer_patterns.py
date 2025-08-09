#!/usr/bin/env python3
"""Debug script to test answer pattern matching in detail."""

import re

def test_patterns_detailed():
    """Test the exact same patterns used in the main parser."""
    
    # Read the answer file
    with open("docs/exam-material/AWS SAA-03 Solution.txt", 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    # Same patterns as main parser
    answer_patterns = [
        # Pattern 1: ans- format
        {
            'name': 'ans_format',
            'pattern': re.compile(r'ans-\s*(.+?)(?=\n\n|\n[A-Z]|$)', re.DOTALL | re.IGNORECASE),
            'priority': 1
        },
        # Pattern 2: Letter with period format
        {
            'name': 'letter_format', 
            'pattern': re.compile(r'^([A-E])\.\s*(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL),
            'priority': 2
        },
        # Pattern 3: Letter without period format
        {
            'name': 'hybrid_format',
            'pattern': re.compile(r'^([A-E])\s+(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL),
            'priority': 3
        }
    ]
    
    # Test segmentation
    question_delimiter = re.compile(r'(\d+)\]', re.MULTILINE)
    matches = list(question_delimiter.finditer(content))
    
    print(f"Testing first 10 segments with exact parser logic...")
    
    for i in range(min(10, len(matches))):
        match = matches[i]
        question_num = int(match.group(1))
        start_pos = match.start()
        
        # Get end position
        if i + 1 < len(matches):
            end_pos = matches[i + 1].start()
        else:
            end_pos = len(content)
        
        segment_content = content[start_pos:end_pos].strip()
        
        print(f"\n=== TESTING SEGMENT {question_num} ===")
        print(f"Content length: {len(segment_content)}")
        
        # Clean the content (same as main parser)
        cleaned_content = clean_segment_content(segment_content)
        print(f"Cleaned length: {len(cleaned_content)}")
        print("Cleaned content preview:")
        print(repr(cleaned_content[:300]))
        
        # Test each pattern
        found_match = False
        for pattern_info in answer_patterns:
            pattern = pattern_info['pattern']
            format_name = pattern_info['name']
            
            match_obj = pattern.search(cleaned_content)
            if match_obj:
                print(f"✓ MATCH with {format_name}")
                
                # Extract answer text (same logic as main parser)
                if format_name == 'ans_format':
                    answer_text = match_obj.group(1).strip()
                else:
                    if len(match_obj.groups()) >= 2:
                        answer_text = match_obj.group(2).strip()
                    else:
                        answer_text = match_obj.group(1).strip()
                
                # Clean answer text
                cleaned_answer = clean_answer_text(answer_text)
                print(f"  Raw match: {repr(match_obj.group(0)[:200])}")
                print(f"  Cleaned answer: {repr(cleaned_answer[:100])}")
                
                # Test validation
                is_valid = validate_answer_text(cleaned_answer)
                print(f"  Validation result: {is_valid}")
                
                if is_valid:
                    print(f"  ✓ This should be extracted!")
                    found_match = True
                    break
                else:
                    print(f"  ✗ Failed validation")
            else:
                print(f"✗ No match with {format_name}")
        
        if not found_match:
            print("❌ NO VALID MATCH FOUND")
            # Show some sample lines to help debug
            lines = cleaned_content.split('\n')
            print("Sample lines:")
            for j, line in enumerate(lines[:15]):
                if line.strip():
                    print(f"  {j}: {repr(line[:80])}")

def clean_segment_content(content: str) -> str:
    """Same cleaning as main parser."""
    content = content.replace('\x00', ' ')
    content = content.replace('\ufeff', '')
    content = content.replace('\r\n', '\n').replace('\r', '\n')
    content = re.sub(r'[ \t]+', ' ', content)
    content = re.sub(r'\n\s*\n', '\n\n', content)
    return content.strip()

def clean_answer_text(text: str) -> str:
    """Same cleaning as main parser."""
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'^[A-E]\.?\s*', '', text)
    text = text.replace('ans-', '').strip()
    
    if len(text) > 200:
        sentences = re.split(r'(?<=[.!])\s+', text)
        if sentences:
            answer_text = sentences[0]
            if len(answer_text) < 100 and len(sentences) > 1:
                answer_text += ' ' + sentences[1]
            if len(answer_text) < 150 and len(sentences) > 2:
                answer_text += ' ' + sentences[2]
            text = answer_text
    
    text = re.sub(r'[-=]{3,}.*$', '', text, flags=re.MULTILINE)
    text = text.replace('\n', ' ')
    text = re.sub(r'\s*[.]{2,}$', '', text)
    
    for phrase in [' General line:', ' Conditions:', ' Task:', ' Requirements:', ' Correct answer', ' because:', ' provides', ' allows']:
        if phrase in text:
            text = text.split(phrase)[0]
    
    return text.strip()

def validate_answer_text(text: str) -> bool:
    """Same validation as main parser."""
    if not text or len(text.strip()) < 5:
        return False
    if len(text) > 5000:
        return False
    return True

if __name__ == "__main__":
    test_patterns_detailed()