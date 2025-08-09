#!/usr/bin/env python3
"""Debug script to examine answer file segments and identify parsing issues."""

import re

def debug_segments():
    """Debug the segmentation and answer patterns."""
    
    # Read the answer file
    with open("docs/exam-material/AWS SAA-03 Solution.txt", 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()
    
    print(f"Total content length: {len(content)} characters")
    
    # Test question segmentation
    question_delimiter = re.compile(r'(\d+)\]', re.MULTILINE)
    matches = list(question_delimiter.finditer(content))
    
    print(f"Found {len(matches)} question segments")
    
    # Examine first 5 segments in detail
    for i in range(min(5, len(matches))):
        match = matches[i]
        question_num = int(match.group(1))
        start_pos = match.start()
        
        # Get end position
        if i + 1 < len(matches):
            end_pos = matches[i + 1].start()
        else:
            end_pos = len(content)
        
        segment_content = content[start_pos:end_pos].strip()
        
        print(f"\n=== SEGMENT {question_num} ===")
        print(f"Length: {len(segment_content)} characters")
        print("Content:")
        print(repr(segment_content[:500]))  # First 500 chars
        
        # Test answer patterns
        patterns = [
            ('ans_format', re.compile(r'ans-\s*(.+?)(?=\n\n|\n[A-Z]|$)', re.DOTALL | re.IGNORECASE)),
            ('letter_format', re.compile(r'^([A-E])\.\s*(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL)),
            ('hybrid_format', re.compile(r'^([A-E])\s+(.+?)(?=\n\n|$)', re.MULTILINE | re.DOTALL))
        ]
        
        found_answer = False
        for pattern_name, pattern in patterns:
            match_obj = pattern.search(segment_content)
            if match_obj:
                print(f"MATCH with {pattern_name}: {repr(match_obj.group(0)[:100])}")
                found_answer = True
                break
        
        if not found_answer:
            print("NO ANSWER PATTERN MATCHED")
            
            # Look for any potential answer indicators
            lines = segment_content.split('\n')
            for j, line in enumerate(lines[:20]):  # First 20 lines
                if any(indicator in line.lower() for indicator in ['ans', 'answer', 'correct', 'option']):
                    print(f"  Potential answer line {j}: {repr(line)}")

if __name__ == "__main__":
    debug_segments()