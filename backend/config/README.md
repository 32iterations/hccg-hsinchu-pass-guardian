# Firebase Configuration

## Setup Instructions

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a new project or use existing project
   - Enable Authentication and Cloud Messaging

2. **Download Service Account**
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Rename it to `firebase-service-account.json`
   - Place it in this directory

3. **Configure Mobile Apps**
   - Add Android app to Firebase project
   - Download `google-services.json`
   - Place in `mobile/HsinchuPassGuardian/android/app/`
   - Add iOS app to Firebase project
   - Download `GoogleService-Info.plist`
   - Place in `mobile/HsinchuPassGuardian/ios/`

## File Structure
```
backend/config/
├── firebase-service-account.json (⚠️ DO NOT COMMIT)
└── firebase-service-account.template.json (Template)

mobile/HsinchuPassGuardian/
├── android/app/google-services.json (⚠️ DO NOT COMMIT)
└── ios/GoogleService-Info.plist (⚠️ DO NOT COMMIT)
```

## Environment Variables
Alternatively, you can use environment variables:
```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

## Security Notes
- ⚠️ **NEVER commit actual Firebase credentials to Git**
- 🔒 Use environment variables in production
- 🛡️ Restrict Firebase service account permissions
- 📱 Configure FCM properly for push notifications