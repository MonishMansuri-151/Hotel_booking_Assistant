from collections import defaultdict

# Development-only in-memory state. For production/serverless, use Redis or DB.
sessions = defaultdict(dict)
