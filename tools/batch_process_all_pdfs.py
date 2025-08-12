#!/usr/bin/env python3
"""
Batch process all PDFs with the fixed V2 parser
"""

import subprocess
import sys
from pathlib import Path
import json

def process_all_pdfs():
    """Process all PDFs in exam-material directory"""
    
    # PDF files to process
    pdfs = [
        "aif-c01_3.pdf",
        "aif-c01_6.pdf", 
        "clf-c02_2.pdf",
        "clf-c02_6.pdf",
        "sap-c02_6.pdf",
        "sap-c02_7.pdf",
        "sap-c02_8.pdf",
        "aws-certified-solutions-architect-professional_8.pdf"
    ]
    
    base_dir = Path("/mnt/c/Projects/study-app")
    input_dir = base_dir / "docs/exam-material"
    output_dir = base_dir / "data/v2/fixed_extraction"
    
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    results = []
    total_questions = 0
    
    for pdf_file in pdfs:
        pdf_path = input_dir / pdf_file
        output_file = pdf_file.replace('.pdf', '_fixed_questions.json')
        output_path = output_dir / output_file
        
        if not pdf_path.exists():
            print(f"❌ PDF not found: {pdf_path}")
            continue
            
        print(f"\n🔄 Processing: {pdf_file}")
        
        try:
            # Run the fixed parser
            cmd = [
                "python", 
                str(base_dir / "tools/v2_pdf_parser_fixed.py"),
                "--input", str(pdf_path),
                "--output", str(output_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(base_dir))
            
            if result.returncode == 0:
                # Parse the results
                with open(output_path) as f:
                    data = json.load(f)
                    
                questions = data['metadata']['questions_extracted']
                answers = data['metadata']['questions_with_answers']
                explanations = data['metadata']['questions_with_explanations']
                
                print(f"✅ {pdf_file}: {questions} questions, {answers} answers, {explanations} explanations")
                
                results.append({
                    'pdf': pdf_file,
                    'questions': questions,
                    'answers': answers,
                    'explanations': explanations,
                    'output_file': output_file
                })
                
                total_questions += questions
                
            else:
                print(f"❌ Failed to process {pdf_file}")
                print(f"Error: {result.stderr}")
                
        except Exception as e:
            print(f"❌ Exception processing {pdf_file}: {str(e)}")
    
    # Summary
    print(f"\n{'='*50}")
    print(f"BATCH PROCESSING COMPLETE")
    print(f"{'='*50}")
    
    for result in results:
        print(f"{result['pdf']:<50} {result['questions']:>3} questions")
    
    print(f"{'='*50}")
    print(f"{'TOTAL':<50} {total_questions:>3} questions")
    print(f"Output directory: {output_dir}")
    
    return results

if __name__ == "__main__":
    process_all_pdfs()