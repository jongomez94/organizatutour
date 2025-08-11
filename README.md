# FungiTour Organizer

A modern React web application for organizing tour logistics with real-time updates using Firebase. This app helps tour organizers manage payments, bus reservations, and vehicle sharing among participants.

## 🚀 Features

- **Payment Tracking**: Participants can mark when they've made transfers with real-time updates
- **Bus Signups**: Real-time bus reservation system with participant tracking
- **Vehicle Management**: Participants can offer their vehicles with seat reservations
- **Real-time Updates**: All changes sync instantly across all users via Firebase
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Local Storage**: Remembers user names for convenience

## 🛠️ Tech Stack

- **Frontend**: React 19 with Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase Firestore
- **Real-time**: Firebase onSnapshot listeners
- **Build Tool**: Vite

## 📋 Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- Firebase project with Firestore enabled

## 🚀 Quick Start

### 1. Clone the repository
```bash
git clone https://github.com/jongomez94/organizatutour.git
cd organizatutour
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure Firebase
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Update the `FIREBASE_CONFIG` object in `src/App.jsx` with your Firebase project credentials:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

### 4. Run the development server
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 📱 Usage

### For Tour Organizers
1. Share the app URL with participants
2. Monitor payments, bus signups, and vehicle availability in real-time
3. Use the tour ID parameter to organize multiple tours: `?tour=myTourId`

### For Participants
1. Enter your name (saved locally for convenience)
2. Mark when you've made a payment
3. Sign up for the rented bus if needed
4. Offer your vehicle with available seats
5. Reserve seats in other participants' vehicles

## 🔧 Configuration

### Multiple Tours
To organize multiple tours, add a tour parameter to the URL:
```
https://yourapp.com?tour=summer2024
https://yourapp.com?tour=winter2024
```

### Firebase Security Rules
For development, you can use these basic rules (not recommended for production):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tours/{tourId}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

For production, implement proper authentication and more restrictive rules.

## 🚀 Deployment

### Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`

### Netlify
1. Build the project: `npm run build`
2. Upload the `dist` folder to Netlify

### Firebase Hosting
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Initialize: `firebase init hosting`
3. Build: `npm run build`
4. Deploy: `firebase deploy`

## 📊 Data Structure

The app uses the following Firestore structure:

```
tours/{tourId}/
├── payments/{autoId}              { name, createdAt }
├── busSignups/{autoId}            { name, createdAt }
└── vehicles/{vehicleId}           { ownerName, seatsTotal, createdAt }
    └── reservations/{autoId}      { name, createdAt }
```

## 🔒 Security Considerations

- **Firebase Configuration**: Never commit real Firebase credentials to public repositories
- **Environment Variables**: Use `.env` files for sensitive configuration
- **Authentication**: Consider implementing user authentication for production use
- **Security Rules**: Implement proper Firestore security rules

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -am 'Add feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🆘 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/jongomez94/organizatutour/issues) page
2. Create a new issue with detailed information
3. Contact the maintainers

## 🙏 Acknowledgments

- Built with React and Firebase
- Styled with Tailwind CSS
- Deployed with Vite
