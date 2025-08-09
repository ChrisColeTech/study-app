#!/usr/bin/env python3
"""
Service Classifier for AWS Questions

Analyzes question text to determine which AWS service area(s) the question covers
and assigns appropriate topic groups for studying.
"""

import re
from typing import Dict, List, Tuple, Set

class ServiceClassifier:
    """Classify AWS questions by service area based on content analysis."""
    
    def __init__(self):
        """Initialize service classification patterns and mappings."""
        
        # Define service patterns and their topic mappings
        self.service_topics = {
            1: {  # Storage Services
                'name': 'Storage Services',
                'services': ['S3', 'EBS', 'EFS', 'FSx', 'Storage Gateway', 'Snowball', 'Snowmobile'],
                'keywords': [
                    # S3 specific
                    r'\bS3\b', r'\bsimple storage service\b', r'\bbucket\b', r'\bobject storage\b',
                    r'\bglacier\b', r'\blifecycle\b', r'\bversioning\b', r'\bcross.region replication\b',
                    r'\bmultipart upload\b', r'\btransfer acceleration\b', r'\bstorage class\b',
                    # EBS specific  
                    r'\bEBS\b', r'\belastic block store\b', r'\bvolume\b', r'\bsnapshot\b',
                    r'\bIOPS\b', r'\bgp2\b', r'\bgp3\b', r'\bio1\b', r'\bio2\b',
                    # EFS specific
                    r'\bEFS\b', r'\belastic file system\b', r'\bNFS\b',
                    # Storage Gateway
                    r'\bstorage gateway\b', r'\bfile gateway\b', r'\bvolume gateway\b',
                    # Snow family
                    r'\bsnowball\b', r'\bsnowmobile\b', r'\bsnow family\b'
                ]
            },
            
            2: {  # Compute Services
                'name': 'Compute Services', 
                'services': ['EC2', 'Lambda', 'Auto Scaling', 'ELB', 'ECS', 'EKS', 'Batch'],
                'keywords': [
                    # EC2 specific
                    r'\bEC2\b', r'\belastic compute cloud\b', r'\binstance\b', r'\bAMI\b',
                    r'\binstance type\b', r'\bplacement group\b', r'\buser data\b', r'\bmetadata\b',
                    r'\bkey pair\b', r'\bsecurity group\b', r'\binstance profile\b',
                    # Lambda specific
                    r'\blambda\b', r'\bserverless\b', r'\bevent trigger\b', r'\bfunction\b',
                    # Auto Scaling
                    r'\bauto scaling\b', r'\bscaling group\b', r'\blaunch template\b', r'\bscaling policy\b',
                    # Load Balancing
                    r'\bELB\b', r'\bload balancer\b', r'\bapplication load balancer\b', r'\bALB\b',
                    r'\bnetwork load balancer\b', r'\bNLB\b', r'\btarget group\b',
                    # Container services
                    r'\bECS\b', r'\bEKS\b', r'\bcontainer\b', r'\bkubernetes\b', r'\bdocker\b',
                    # Batch
                    r'\bbatch\b', r'\bjob queue\b'
                ]
            },
            
            3: {  # Networking
                'name': 'Networking & Content Delivery',
                'services': ['VPC', 'Route 53', 'CloudFront', 'Direct Connect', 'Transit Gateway'],
                'keywords': [
                    # VPC specific
                    r'\bVPC\b', r'\bvirtual private cloud\b', r'\bsubnet\b', r'\broute table\b',
                    r'\binternet gateway\b', r'\bIGW\b', r'\bNAT gateway\b', r'\bNAT instance\b',
                    r'\bNACL\b', r'\bnetwork ACL\b', r'\bpeering\b', r'\bVPC endpoint\b',
                    # Route 53
                    r'\broute\s*53\b', r'\bDNS\b', r'\bhosted zone\b', r'\bhealth check\b',
                    r'\bfailover\b', r'\bweighted routing\b', r'\blatency routing\b',
                    # CloudFront
                    r'\bcloudfront\b', r'\bCDN\b', r'\bcontent delivery\b', r'\bdistribution\b',
                    r'\bedge location\b', r'\borigin\b', r'\bcache\b',
                    # Direct Connect
                    r'\bdirect connect\b', r'\bdedicated connection\b', r'\bvirtual interface\b',
                    # Transit Gateway
                    r'\btransit gateway\b', r'\bTGW\b'
                ]
            },
            
            4: {  # Databases
                'name': 'Databases',
                'services': ['RDS', 'DynamoDB', 'ElastiCache', 'Redshift', 'Aurora', 'DocumentDB'],
                'keywords': [
                    # RDS specific
                    r'\bRDS\b', r'\brelational database\b', r'\bMySQL\b', r'\bPostgreSQL\b',
                    r'\bOracle\b', r'\bSQL Server\b', r'\bMariaDB\b', r'\breadreplica\b',
                    r'\bmulti.AZ\b', r'\bbackup\b', r'\bsnapshot\b', r'\bparameter group\b',
                    # DynamoDB
                    r'\bDynamoDB\b', r'\bNoSQL\b', r'\btable\b', r'\bindex\b', r'\bGSI\b', r'\bLSI\b',
                    r'\bpartition key\b', r'\bsort key\b', r'\bDAX\b', r'\bstream\b',
                    # ElastiCache
                    r'\belasticache\b', r'\bRedis\b', r'\bMemcached\b', r'\bcaching\b', r'\bcluster\b',
                    # Aurora
                    r'\baurora\b', r'\baurora serverless\b',
                    # Redshift
                    r'\bredshift\b', r'\bdata warehouse\b', r'\bcolumnar\b',
                    # DocumentDB
                    r'\bdocumentdb\b', r'\bmongodb\b'
                ]
            },
            
            5: {  # Security & Identity
                'name': 'Security & Identity',
                'services': ['IAM', 'KMS', 'CloudTrail', 'Config', 'GuardDuty', 'WAF', 'Shield'],
                'keywords': [
                    # IAM specific
                    r'\bIAM\b', r'\bidentity and access\b', r'\buser\b', r'\brole\b', r'\bpolicy\b',
                    r'\bpermission\b', r'\bassume role\b', r'\bfederation\b', r'\bSTS\b',
                    r'\bmultifactor\b', r'\bMFA\b', r'\baccess key\b',
                    # KMS
                    r'\bKMS\b', r'\bkey management\b', r'\bencryption\b', r'\bencrypt\b', r'\bdecrypt\b',
                    r'\bcustomer managed key\b', r'\bCMK\b', r'\bdata key\b',
                    # CloudTrail
                    r'\bcloudtrail\b', r'\baudit\b', r'\blogging\b', r'\bAPI call\b', r'\btrail\b',
                    # Config
                    r'\bconfig\b', r'\bcompliance\b', r'\bconfiguration\b',
                    # GuardDuty
                    r'\bguardduty\b', r'\bthreat detection\b', r'\bmalicious\b',
                    # WAF & Shield
                    r'\bWAF\b', r'\bweb application firewall\b', r'\bshield\b', r'\bDDoS\b'
                ]
            },
            
            6: {  # Messaging & Integration
                'name': 'Messaging & Integration',
                'services': ['SQS', 'SNS', 'Kinesis', 'API Gateway', 'Step Functions', 'EventBridge'],
                'keywords': [
                    # SQS
                    r'\bSQS\b', r'\bsimple queue service\b', r'\bqueue\b', r'\bmessage\b',
                    r'\bFIFO\b', r'\bstandard queue\b', r'\bvisibility timeout\b',
                    # SNS
                    r'\bSNS\b', r'\bsimple notification\b', r'\btopic\b', r'\bsubscription\b',
                    r'\bpublish\b', r'\bsubscribe\b', r'\bfan.out\b',
                    # Kinesis
                    r'\bkinesis\b', r'\bdata stream\b', r'\bfirehose\b', r'\banalytics\b',
                    r'\bshard\b', r'\bpartition key\b', r'\bstreaming\b',
                    # API Gateway
                    r'\bAPI gateway\b', r'\bREST API\b', r'\bHTTP API\b', r'\bendpoint\b',
                    r'\bthrottling\b', r'\bstage\b', r'\bresource\b',
                    # Step Functions
                    r'\bstep functions\b', r'\bstate machine\b', r'\bworkflow\b',
                    # EventBridge
                    r'\beventbridge\b', r'\bevent rule\b', r'\bevent pattern\b'
                ]
            },
            
            7: {  # Monitoring & Management
                'name': 'Monitoring & Management',
                'services': ['CloudWatch', 'CloudFormation', 'Systems Manager', 'Trusted Advisor', 'Cost Explorer'],
                'keywords': [
                    # CloudWatch
                    r'\bcloudwatch\b', r'\bmetric\b', r'\balarm\b', r'\bmonitoring\b',
                    r'\blog group\b', r'\blog stream\b', r'\bdashboard\b', r'\binsights\b',
                    # CloudFormation
                    r'\bcloudformation\b', r'\btemplate\b', r'\bstack\b', r'\bresource\b',
                    r'\bparameter\b', r'\boutput\b', r'\bdrift\b',
                    # Systems Manager
                    r'\bsystems manager\b', r'\bSSM\b', r'\bparameter store\b', r'\bsession manager\b',
                    r'\bpatch manager\b', r'\brunbook\b',
                    # Trusted Advisor
                    r'\btrusted advisor\b', r'\brecommendation\b', r'\boptimization\b',
                    # Cost management
                    r'\bcost explorer\b', r'\bbilling\b', r'\bcost\b', r'\bpricing\b',
                    r'\breserved instance\b', r'\bRI\b', r'\bsavings plan\b'
                ]
            }
        }
        
        # Compile regex patterns for better performance
        for topic_id, topic_info in self.service_topics.items():
            topic_info['compiled_patterns'] = [
                re.compile(pattern, re.IGNORECASE) for pattern in topic_info['keywords']
            ]
    
    def classify_question(self, question_text: str) -> Tuple[int, float, List[str]]:
        """
        Classify a question into a topic based on content analysis.
        
        Args:
            question_text: The question text to analyze
            
        Returns:
            Tuple of (topic_id, confidence_score, detected_services)
        """
        # Analyze text for each topic
        topic_scores = {}
        detected_services = {}
        
        for topic_id, topic_info in self.service_topics.items():
            matches = 0
            services_found = []
            
            # Count pattern matches
            for pattern in topic_info['compiled_patterns']:
                if pattern.search(question_text):
                    matches += 1
                    # Try to identify which service was matched
                    match_obj = pattern.search(question_text)
                    if match_obj:
                        service_match = match_obj.group().upper()
                        if service_match not in services_found:
                            services_found.append(service_match)
            
            if matches > 0:
                # Score based on number of matches and service relevance
                score = matches / len(topic_info['compiled_patterns'])
                topic_scores[topic_id] = score
                detected_services[topic_id] = services_found
        
        if not topic_scores:
            # Default to topic 7 (general) if no clear match
            return 7, 0.1, ['GENERAL']
        
        # Get the topic with highest score
        best_topic = max(topic_scores.items(), key=lambda x: x[1])
        topic_id = best_topic[0]
        confidence = best_topic[1]
        services = detected_services.get(topic_id, [])
        
        return topic_id, confidence, services
    
    def get_topic_info(self, topic_id: int) -> Dict:
        """Get information about a topic."""
        return self.service_topics.get(topic_id, {})
    
    def analyze_distribution(self, questions: List[Dict]) -> Dict:
        """
        Analyze the distribution of questions across topics.
        
        Args:
            questions: List of question dictionaries
            
        Returns:
            Dictionary with distribution statistics
        """
        topic_counts = {}
        confidence_scores = []
        service_detections = {}
        
        for question in questions:
            topic_id, confidence, services = self.classify_question(question['question_text'])
            
            # Update counts
            topic_counts[topic_id] = topic_counts.get(topic_id, 0) + 1
            confidence_scores.append(confidence)
            
            # Track service detections
            for service in services:
                if service not in service_detections:
                    service_detections[service] = 0
                service_detections[service] += 1
        
        return {
            'topic_distribution': topic_counts,
            'avg_confidence': sum(confidence_scores) / len(confidence_scores),
            'service_frequency': dict(sorted(service_detections.items(), 
                                           key=lambda x: x[1], reverse=True)),
            'total_classified': len(questions)
        }


def demo_classifier():
    """Demo the classifier with sample questions."""
    classifier = ServiceClassifier()
    
    sample_questions = [
        "A company collects data for temperature, humidity, and atmospheric pressure in cities across multiple continents. The company wants to aggregate the data from all these global sites as quickly as possible in a single Amazon S3 bucket.",
        
        "An application runs on an Amazon EC2 instance in a VPC. The application processes logs that are stored in an Amazon S3 bucket. The EC2 instance needs to access the S3 bucket without connectivity to the internet.",
        
        "A company needs the ability to analyze the log files of its proprietary application. The logs are stored in JSON format in an Amazon S3 bucket. Queries will be simple and will run on-demand. A solutions architect needs to perform the analysis with minimal changes to the existing architecture using Amazon Athena.",
        
        "A company uses AWS Organizations to manage multiple AWS accounts for different departments. The management account has an Amazon S3 bucket that contains project reports. The company wants to limit access to this S3 bucket to only users of accounts within the organization using IAM policies.",
        
        "A solutions architect is designing a distributed application that will run on multiple Amazon EC2 instances. The application requires a shared file system that can be accessed concurrently from Linux-based EC2 instances in multiple Availability Zones."
    ]
    
    print("=== Service Classification Demo ===\n")
    
    for i, question in enumerate(sample_questions, 1):
        topic_id, confidence, services = classifier.classify_question(question)
        topic_info = classifier.get_topic_info(topic_id)
        
        print(f"Question {i}:")
        print(f"Text: {question[:100]}...")
        print(f"Classified as: Topic {topic_id} - {topic_info.get('name', 'Unknown')}")
        print(f"Confidence: {confidence:.2f}")
        print(f"Services detected: {services}")
        print(f"---")


if __name__ == "__main__":
    demo_classifier()