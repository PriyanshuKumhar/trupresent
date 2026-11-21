# TruPresent

> **A Secure, Proxy-Resistant Smart Attendance Tracking System**  
> Developed as an MCA (Master of Computer Applications) final-year project.

TruPresent eliminates fraudulent proxy attendance in academic environments through multi-factor temporal and physical validation: **dynamic rotating QR codes**, **strict time windows**, **GPS geofencing**, **verified mobile-number roster claims**, and **tamper-proof digital attendance logs**.

---

## 🚀 Key Features

### 👨‍🏫 For Professors
* **Class & Geofence Management**: Configure classroom boundaries ($\pm 30\text{m}$, $\pm 60\text{m}$, $\pm 100\text{m}$, $\pm 150\text{m}$) with Google Maps pin verification.
* **Live Dynamic Session**: Generates rolling cryptographic QR codes rotating every **15 seconds** with a live visual countdown progress bar.
* **Real-time Projector Feed**: Visual grid tracking live attendance percentage (`42 / 50 Present - 84%`).
* **Manual Override & Exemption**: Authorized overrides for hardware, battery, or medical exemptions with justification tags.
* **Smart Roster Management**: Drag-and-drop `.xlsx` / `.csv` roster import and professionally styled Excel export with summary statistics (`Present`, `Total Held`, `%`, and `Shortage (<75%)` status).

### 🎓 For Students
* **In-Person Attendance Scanning**: Camera-based QR scanner enforcing real-time high-precision GPS verification ($< 65\text{m}$ accuracy threshold).
* **75% Shortage Tracker & Calculator**: Real-time attendance percentage per subject with institutional shortage alerts ($< 75\%$).
* **Predictive Attendance Guidance**:
  * If in shortage: Calculates exact consecutive classes required to reach $75\%$.
  * If safe: Calculates how many classes can be safely missed.
* **Tamper-Proof Proof History**: Cryptographically backed student log that can only be created when a legitimate session record exists.

---

## 🛡️ Anti-Proxy Architecture & Security

| Mechanism | Description | Enforcement Point |
| :--- | :--- | :--- |
| **Rolling QR Tokens** | Tokens rotate every 15 seconds; valid for a maximum of 20 seconds. | Cloud Firestore Rules |
| **Server-Side Session Eavesdrop Block** | Session read access is restricted to the owning professor. Tokens can only be acquired visually via camera. | Cloud Firestore Rules |
| **Classroom Geofencing** | Validates device GPS against classroom latitude/longitude boundaries. | Cloud Firestore Rules + Geolocation API |
| **GPS Accuracy Threshold** | Rejects coarse cell-tower triangulation ($> 65\text{m}$ error radius) to prevent remote spoofing. | Client Geolocation Validation |
| **Roster Claim Verification** | Student can only claim a roll number if their registered mobile matches the professor's roster. | Cloud Firestore Rules |
| **One-Claim-Per-Student** | Subcollection locking guarantees 1 student = 1 roll number per class. | Cloud Firestore Rules |

---

## 🛠️ Tech Stack

* **Frontend**: React 19, Vite, React Router v7 (`react-router-dom`)
* **Styling**: Vanilla CSS (Custom dark theme with responsive typography)
* **Backend & Database**: Firebase Authentication & Cloud Firestore
* **QR Generation & Scanning**: `qrcode.react`, `html5-qrcode`
* **Data Processing**: `exceljs` (In-browser Excel parsing and styled reporting)
* **Linting & Code Quality**: Oxlint

---

## 📦 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18 or higher)
* [Git](https://git-scm.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/trupresent.git
cd trupresent
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Add your Firebase project configuration:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### 4. Run Locally
```bash
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🚢 Production Build & Deployment

### Build
```bash
npm run build
```

### Deploy to Firebase Hosting
```bash
firebase login
firebase deploy
```

---

## 📄 License
This project was developed for academic and demonstration purposes.
