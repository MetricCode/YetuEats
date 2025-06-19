const admin = require('firebase-admin');
const readline = require('readline');
const path = require('path');

// Initialize Firebase Admin SDK
// Replace 'service-account-key.json' with your downloaded file name
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
});

const db = admin.firestore();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function displayMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('🍽️  YETU EATS - USER CREATION TOOL');
  console.log('='.repeat(50));
  console.log('');
}

async function getUserInput() {
  const userData = {};

  // Get basic information
  userData.name = await askQuestion('👤 Enter full name: ');
  
  while (!userData.name) {
    console.log('❌ Name is required!');
    userData.name = await askQuestion('👤 Enter full name: ');
  }

  userData.email = await askQuestion('📧 Enter email address: ');
  
  while (!isValidEmail(userData.email)) {
    console.log('❌ Please enter a valid email address!');
    userData.email = await askQuestion('📧 Enter email address: ');
  }

  userData.phone = await askQuestion('📱 Enter phone number (e.g., +254712345678): ');
  
  while (!userData.phone) {
    console.log('❌ Phone number is required!');
    userData.phone = await askQuestion('📱 Enter phone number: ');
  }

  // Get user type
  console.log('\n📋 Select User Type:');
  console.log('1. 👥 Customer');
  console.log('2. 🍽️  Restaurant');
  console.log('3. 🚴 Delivery Personnel');
  
  let userTypeChoice;
  do {
    userTypeChoice = await askQuestion('Select option (1-3): ');
  } while (!['1', '2', '3'].includes(userTypeChoice));

  const userTypeMap = {
    '1': 'customer',
    '2': 'restaurant', 
    '3': 'delivery'
  };
  
  userData.userType = userTypeMap[userTypeChoice];

  // Get type-specific information
  if (userData.userType === 'restaurant') {
    userData.restaurantName = await askQuestion('🏪 Enter restaurant name: ');
    while (!userData.restaurantName) {
      console.log('❌ Restaurant name is required!');
      userData.restaurantName = await askQuestion('🏪 Enter restaurant name: ');
    }
    userData.restaurantAddress = await askQuestion('📍 Enter restaurant address (optional): ');
  } else if (userData.userType === 'delivery') {
    console.log('\n🚗 Select Vehicle Type:');
    console.log('1. 🏍️  Motorcycle');
    console.log('2. 🚲 Bicycle');
    console.log('3. 🚗 Car');
    console.log('4. 🛵 Scooter');
    
    let vehicleChoice;
    do {
      vehicleChoice = await askQuestion('Select vehicle (1-4): ');
    } while (!['1', '2', '3', '4'].includes(vehicleChoice));

    const vehicleMap = {
      '1': 'Motorcycle',
      '2': 'Bicycle',
      '3': 'Car',
      '4': 'Scooter'
    };
    
    userData.vehicleType = vehicleMap[vehicleChoice];
    
    userData.licenseNumber = await askQuestion('🆔 Enter license number: ');
    while (!userData.licenseNumber) {
      console.log('❌ License number is required for delivery personnel!');
      userData.licenseNumber = await askQuestion('🆔 Enter license number: ');
    }
  }

  return userData;
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

async function confirmUserCreation(userData) {
  console.log('\n' + '='.repeat(50));
  console.log('📝 CONFIRM USER DETAILS');
  console.log('='.repeat(50));
  console.log(`👤 Name: ${userData.name}`);
  console.log(`📧 Email: ${userData.email}`);
  console.log(`📱 Phone: ${userData.phone}`);
  console.log(`👔 Type: ${userData.userType.charAt(0).toUpperCase() + userData.userType.slice(1)}`);
  
  if (userData.restaurantName) {
    console.log(`🏪 Restaurant: ${userData.restaurantName}`);
    if (userData.restaurantAddress) {
      console.log(`📍 Address: ${userData.restaurantAddress}`);
    }
  }
  
  if (userData.vehicleType) {
    console.log(`🚗 Vehicle: ${userData.vehicleType}`);
    console.log(`🆔 License: ${userData.licenseNumber}`);
  }
  
  console.log('='.repeat(50));
  
  const confirm = await askQuestion('✅ Create this user? (y/n): ');
  return confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes';
}

async function createUser() {
  try {
    displayMenu();

    // Get user input
    const userData = await getUserInput();

    // Confirm before creating
    const confirmed = await confirmUserCreation(userData);
    
    if (!confirmed) {
      console.log('❌ User creation cancelled.');
      return;
    }

    console.log('\n⏳ Creating user account...');

    // Check if email already exists
    try {
      await admin.auth().getUserByEmail(userData.email);
      console.log('❌ Error: A user with this email already exists!');
      return;
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // User doesn't exist, which is what we want
    }

    // Generate secure password
    const tempPassword = generateSecurePassword();

    // Create user account
    const userRecord = await admin.auth().createUser({
      email: userData.email,
      password: tempPassword,
      displayName: userData.name,
      emailVerified: false,
    });

    console.log('✅ Firebase Auth user created successfully!');

    // Prepare Firestore user data
    const firestoreUserData = {
      uid: userRecord.uid,
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      userType: userData.userType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: true,
      profileComplete: true,
      createdByAdmin: true,
      temporaryPassword: true,
    };

    // Add type-specific fields
    if (userData.userType === 'restaurant') {
      firestoreUserData.restaurantName = userData.restaurantName;
      firestoreUserData.restaurantAddress = userData.restaurantAddress || '';
      firestoreUserData.isVerified = false;
      firestoreUserData.isApproved = false;
      firestoreUserData.businessType = 'restaurant';
    } else if (userData.userType === 'delivery') {
      firestoreUserData.vehicleType = userData.vehicleType;
      firestoreUserData.licenseNumber = userData.licenseNumber;
      firestoreUserData.isVerified = false;
      firestoreUserData.isApproved = false;
      firestoreUserData.isAvailable = false;
      firestoreUserData.deliveryRadius = 10; // Default 10km
    }

    // Save to Firestore users collection
    await db.collection('users').doc(userRecord.uid).set(firestoreUserData);
    console.log('✅ User data saved to Firestore!');

    // Create additional collections based on user type
    if (userData.userType === 'restaurant') {
      await db.collection('restaurants').doc(userRecord.uid).set({
        uid: userRecord.uid,
        name: userData.restaurantName,
        email: userData.email,
        phone: userData.phone,
        address: userData.restaurantAddress || '',
        isActive: true,
        isVerified: false,
        isApproved: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Restaurant profile created!');
    } else if (userData.userType === 'delivery') {
      await db.collection('delivery').doc(userRecord.uid).set({
        uid: userRecord.uid,
        name: userData.name,
        email: userData.email,
        phone: userData.phone,
        vehicleType: userData.vehicleType,
        licenseNumber: userData.licenseNumber,
        isActive: true,
        isVerified: false,
        isApproved: false,
        isAvailable: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('✅ Delivery profile created!');
    }

    // Send password reset email
    try {
      const resetLink = await admin.auth().generatePasswordResetLink(userData.email);
      console.log('✅ Password reset email sent!');
    } catch (emailError) {
      console.log('⚠️  Warning: Could not send password reset email:', emailError.message);
      console.log('   The user can still sign in with the temporary password.');
    }

    // Log the creation
    await db.collection('admin_logs').add({
      action: 'create_user',
      targetUserUid: userRecord.uid,
      userType: userData.userType,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        email: userData.email,
        name: userData.name,
        userType: userData.userType,
        createdByScript: true,
      }
    });

    // Display success information
    console.log('\n' + '='.repeat(50));
    console.log('🎉 USER CREATED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(`👤 User ID: ${userRecord.uid}`);
    console.log(`📧 Email: ${userData.email}`);
    console.log(`🔑 Temporary Password: ${tempPassword}`);
    console.log(`👔 User Type: ${userData.userType}`);
    console.log('');
    console.log('📨 Next Steps:');
    console.log('   1. User should check email for password reset link');
    console.log('   2. Or they can sign in with the temporary password above');
    console.log('   3. They should change their password on first login');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Error creating user:', error.message);
    
    if (error.code === 'auth/email-already-exists') {
      console.log('   → A user with this email already exists.');
    } else if (error.code === 'auth/invalid-email') {
      console.log('   → The email address is invalid.');
    } else if (error.code === 'auth/weak-password') {
      console.log('   → The password is too weak.');
    } else {
      console.log('   → Check your internet connection and Firebase configuration.');
    }
  } finally {
    rl.close();
  }
}

function generateSecurePassword() {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest randomly (total length: 12 characters)
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Run the script
createUser();