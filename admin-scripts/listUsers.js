const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`
});

const db = admin.firestore();

async function listUsers() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('👥 YETU EATS - USER LIST');
    console.log('='.repeat(60));

    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
    
    if (usersSnapshot.empty) {
      console.log('📭 No users found in the database.');
      return;
    }

    console.log(`\n📊 Total Users: ${usersSnapshot.size}\n`);

    let customerCount = 0;
    let restaurantCount = 0;
    let deliveryCount = 0;

    usersSnapshot.forEach((doc, index) => {
      const userData = doc.data();
      const userNumber = index + 1;

      // Count user types
      if (userData.userType === 'customer') customerCount++;
      else if (userData.userType === 'restaurant') restaurantCount++;
      else if (userData.userType === 'delivery') deliveryCount++;

      // Format creation date
      let createdDate = 'Unknown';
      if (userData.createdAt) {
        const date = userData.createdAt.toDate();
        createdDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
      }

      // User type emoji
      const typeEmoji = {
        'customer': '👥',
        'restaurant': '🍽️',
        'delivery': '🚴'
      };

      // Status indicators
      const statusIndicator = userData.isActive ? '✅' : '❌';
      const blockedIndicator = userData.isBlocked ? '🚫' : '';

      console.log(`${userNumber.toString().padStart(3, ' ')}. ${typeEmoji[userData.userType] || '👤'} ${userData.name}`);
      console.log(`     📧 ${userData.email}`);
      console.log(`     📱 ${userData.phone || 'No phone'}`);
      console.log(`     👔 ${userData.userType.charAt(0).toUpperCase() + userData.userType.slice(1)}`);
      console.log(`     📅 Created: ${createdDate}`);
      console.log(`     📊 Status: ${statusIndicator} ${userData.isActive ? 'Active' : 'Inactive'} ${blockedIndicator}`);
      
      if (userData.userType === 'restaurant' && userData.restaurantName) {
        console.log(`     🏪 Restaurant: ${userData.restaurantName}`);
      }
      
      if (userData.userType === 'delivery' && userData.vehicleType) {
        console.log(`     🚗 Vehicle: ${userData.vehicleType}`);
      }
      
      if (userData.createdByAdmin) {
        console.log(`     🔧 Created by Admin`);
      }
      
      console.log('     ' + '-'.repeat(50));
    });

    // Summary
    console.log('\n📈 SUMMARY:');
    console.log(`👥 Customers: ${customerCount}`);
    console.log(`🍽️  Restaurants: ${restaurantCount}`);
    console.log(`🚴 Delivery Personnel: ${deliveryCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error listing users:', error.message);
  }
}

// Run the script
listUsers();