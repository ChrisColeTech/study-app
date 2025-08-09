#!/usr/bin/env python3
"""Debug script to check PDF content extraction."""

import pdfplumber
import re
import sys

def debug_pdf(pdf_path):
    """Debug PDF extraction to see what's in the file."""
    print(f"Opening PDF: {pdf_path}")
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Total pages: {len(pdf.pages)}")
        
        # Check first few pages
        for i in range(min(5, len(pdf.pages))):
            page = pdf.pages[i]
            text = page.extract_text()
            
            print(f"\n=== PAGE {i+1} ===")
            if text:
                print(f"Text length: {len(text)}")
                print("First 500 characters:")
                print(repr(text[:500]))
                
                # Look for question patterns
                question_pattern = re.compile(r'Topic\s+(\d+)\s+Question\s+#(\d+)', re.IGNORECASE)
                matches = question_pattern.findall(text)
                print(f"Question matches: {matches}")
                
                # Look for other patterns
                if "question" in text.lower():
                    print("Contains word 'question'")
                if "aws" in text.lower():
                    print("Contains 'aws'")
            else:
                print("No text extracted from this page")

if __name__ == "__main__":
    debug_pdf("docs/exam-material/AWS Certified Solutions Architect Associate SAA-C03.pdf")