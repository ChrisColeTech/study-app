#!/usr/bin/env python3
"""Analyze topic structure in PDF to see if there are actual topic divisions."""

import pdfplumber
import re

def analyze_topics(pdf_path):
    """Analyze the PDF to understand topic structure."""
    
    with pdfplumber.open(pdf_path) as pdf:
        print(f"Analyzing {len(pdf.pages)} pages for topic structure...")
        
        # Look for topic headers or section breaks
        topic_patterns = [
            re.compile(r'Topic\s+(\d+)', re.IGNORECASE),
            re.compile(r'Section\s+(\d+)', re.IGNORECASE), 
            re.compile(r'Chapter\s+(\d+)', re.IGNORECASE),
            re.compile(r'Domain\s+(\d+)', re.IGNORECASE),
            re.compile(r'Part\s+(\d+)', re.IGNORECASE)
        ]
        
        question_pattern = re.compile(r'Question\s+#(\d+)\s+Topic\s+(\d+)', re.IGNORECASE)
        
        # Sample pages throughout the document
        sample_pages = [1, 10, 50, 100, 150, 200, 240]
        
        for page_num in sample_pages:
            if page_num < len(pdf.pages):
                page = pdf.pages[page_num - 1]  # 0-indexed
                text = page.extract_text()
                
                print(f"\n=== PAGE {page_num} ===")
                
                if text:
                    # Look for questions
                    questions = question_pattern.findall(text)
                    if questions:
                        print(f"Questions found: {questions}")
                    
                    # Look for topic headers
                    for i, pattern in enumerate(topic_patterns):
                        matches = pattern.findall(text)
                        if matches:
                            pattern_names = ['Topic', 'Section', 'Chapter', 'Domain', 'Part']
                            print(f"{pattern_names[i]} numbers found: {matches}")
                    
                    # Look for any other structural indicators
                    lines = text.split('\n')
                    for line in lines[:10]:  # First 10 lines
                        if any(word in line.lower() for word in ['exam', 'topic', 'section', 'domain', 'part', 'chapter']):
                            print(f"Structural line: {line.strip()}")
                else:
                    print("No text on this page")

if __name__ == "__main__":
    analyze_topics("docs/exam-material/AWS Certified Solutions Architect Associate SAA-C03.pdf")