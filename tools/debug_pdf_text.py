#!/usr/bin/env python3
"""
Debug script to examine PDF text patterns
"""

import re
import pdfplumber
import sys
from pathlib import Path

def debug_pdf_patterns(pdf_path):
    """Debug PDF text patterns"""
    print(f"Analyzing: {pdf_path}")
    
    with pdfplumber.open(pdf_path) as pdf:
        # Get first few pages of text
        text = ""
        for i, page in enumerate(pdf.pages[:3]):
            page_text = page.extract_text()
            if page_text:
                text += f"\n--- PAGE {i+1} ---\n{page_text}\n"
        
        print(f"Sample text length: {len(text)}")
        print("\n=== FIRST 2000 CHARACTERS ===")
        print(text[:2000])
        
        # Test patterns
        surepass_pattern = re.compile(r'NEW\s+QUESTION\s+(\d+)', re.IGNORECASE)
        standard_pattern = re.compile(r'Question\s+(?:#)?(\d+)', re.IGNORECASE)
        
        surepass_matches = surepass_pattern.findall(text)
        standard_matches = standard_pattern.findall(text)
        
        print(f"\n=== PATTERN MATCHES ===")
        print(f"SurePassExam 'NEW QUESTION': {len(surepass_matches)}")
        if surepass_matches:
            print(f"First 5 matches: {surepass_matches[:5]}")
            
        print(f"Standard 'Question': {len(standard_matches)}")
        if standard_matches:
            print(f"First 5 matches: {standard_matches[:5]}")
        
        # Look for actual question starts
        print(f"\n=== ACTUAL QUESTION EXAMPLES ===")
        lines = text.split('\n')
        for i, line in enumerate(lines):
            if 'NEW QUESTION' in line.upper():
                print(f"Line {i}: {line.strip()}")
                # Show next few lines too
                for j in range(1, 4):
                    if i+j < len(lines):
                        print(f"  +{j}: {lines[i+j].strip()}")
                print()

if __name__ == "__main__":
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else "/mnt/c/Projects/study-app/docs/exam-material/clf-c02_2.pdf"
    debug_pdf_patterns(pdf_path)