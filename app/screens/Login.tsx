import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  StatusBar,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { FIREBASE_AUTH, FIREBASE_DB } from '../../FirebaseConfig';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+254');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const countryCodes = [
    { code: '+1', country: 'US', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+254', country: 'KE', flag: '🇰🇪' }
  ];

  // Load saved credentials on component mount
  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('rememberedEmail');
      const savedPassword = await AsyncStorage.getItem('rememberedPassword');
      const wasRemembered = await AsyncStorage.getItem('rememberMe');
      
      if (savedEmail) {
        setEmail(savedEmail);
      }
      
      if (wasRemembered === 'true' && savedPassword) {
        setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch (error) {
      console.log('Error loading saved credentials:', error);
    }
  };

  const saveCredentials = async (email: string, password: string, remember: boolean) => {
    try {
      // Always save the email for future use
      await AsyncStorage.setItem('rememberedEmail', email);
      
      if (remember) {
        // Save password and remember preference
        await AsyncStorage.setItem('rememberedPassword', password);
        await AsyncStorage.setItem('rememberMe', 'true');
      } else {
        // Clear saved password and remember preference
        await AsyncStorage.removeItem('rememberedPassword');
        await AsyncStorage.setItem('rememberMe', 'false');
      }
    } catch (error) {
      console.log('Error saving credentials:', error);
    }
  };

  const clearSavedCredentials = async () => {
    try {
      await AsyncStorage.removeItem('rememberedEmail');
      await AsyncStorage.removeItem('rememberedPassword');
      await AsyncStorage.removeItem('rememberMe');
    } catch (error) {
      console.log('Error clearing credentials:', error);
    }
  };

  const handleForgotPassword = async () => {
    // Use current email if resetEmail is empty
    const emailToReset = resetEmail.trim() || email.trim();
    
    if (!emailToReset) {
      Alert.alert('Email Required', 'Please enter your email address to reset your password.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToReset)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);

    try {
      await sendPasswordResetEmail(FIREBASE_AUTH, emailToReset);
      
      Alert.alert(
        'Reset Email Sent!',
        `We've sent password reset instructions to ${emailToReset}. Please check your email and follow the instructions to reset your password.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowForgotPassword(false);
              setResetEmail('');
            }
          }
        ]
      );
    } catch (error) {
      console.log('Password reset failed');
      Alert.alert(
        'Reset Failed',
        'Unable to send password reset email. Please check your email address and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const validateInputs = () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return false;
    }

    if (!isLogin && (!name.trim() || !phoneNumber.trim())) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return false;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }

    return true;
  };

  type UserType = {
    uid: string;
    displayName?: string | null;
    email: string | null;
  };

  type UserDataType = {
    name?: string;
    phoneNumber?: string;
    countryCode?: string;
    profileComplete?: boolean;
    [key: string]: any;
  };

  const createUserDocument = async (user: UserType, userData: UserDataType = {}) => {
    const defaultData = {
      uid: user.uid,
      name: user.displayName || userData.name || 'User',
      email: user.email,
      userType: 'customer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      profileComplete: false,
      ...userData
    };

    await setDoc(doc(FIREBASE_DB, 'users', user.uid), defaultData);
  };

  const handleSignIn = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        FIREBASE_AUTH, 
        email.trim(), 
        password
      );
      
      const userDoc = await getDoc(doc(FIREBASE_DB, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        await createUserDocument(userCredential.user);
      }
      
      // Save credentials after successful login
      await saveCredentials(email.trim(), password, rememberMe);
      
      console.log('Sign in successful');
    } catch (error) {
      console.log('Login failed');
      throw error;
    }
  };

  const handleSignUp = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        FIREBASE_AUTH, 
        email.trim(), 
        password
      );
      
      await updateProfile(userCredential.user, { displayName: name.trim() });
      
      await createUserDocument(userCredential.user, {
        name: name.trim(),
        phoneNumber: countryCode + phoneNumber.trim(),
        countryCode: countryCode,
        profileComplete: true,
      });
      
      Alert.alert('Success', `Welcome to Yetu Eats, ${name}!`);
      console.log('Sign up successful');
    } catch (error) {
      console.log('Registration failed');
      throw error;
    }
  };

  const handleAuth = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    
    try {
      if (isLogin) {
        await handleSignIn();
      } else {
        await handleSignUp();
      }
    } catch (error) {
      Alert.alert(
        isLogin ? 'Sign In Failed' : 'Sign Up Failed',
        'Authentication failed. Please try again.',
        [{
          text: 'OK',
          onPress: () => {
            setPassword('');
            if (!isLogin) setConfirmPassword('');
          }
        }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    
    try {
      // Google sign-in implementation would go here
      // For now, just show a placeholder
      Alert.alert('Google Sign In', 'Google sign-in coming soon!');
    } catch (error) {
      console.log('Google sign-in failed');
      Alert.alert('Sign In Failed', 'Google sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setPhoneNumber('');
    setRememberMe(false);
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
    // Don't clear email when switching modes, keep it for convenience
    setPassword('');
    setConfirmPassword('');
    setName('');
    setPhoneNumber('');
    // Reset remember me when switching to signup
    if (isLogin) {
      setRememberMe(false);
    }
  };

  const renderWelcomeScreen = () => (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
        style={styles.gradient}
      >
        <View style={styles.welcomeContainer}>
          <Text style={styles.welcomeTitle}>Yetu Eats</Text>
          <Text style={styles.welcomeSubtitle}>
            Delicious meals delivered to your doorstep
          </Text>
          
          <TouchableOpacity 
            style={styles.getStartedButton}
            onPress={() => {
              setShowWelcome(false);
              setIsLogin(false);
            }}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>

          <View style={styles.socialContainer}>
            <Text style={styles.socialText}>Sign in with</Text>
            <TouchableOpacity 
              style={styles.socialButton}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={24} color="#DB4437" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => {
            setShowWelcome(false);
            setIsLogin(true);
          }}>
            <Text style={styles.signInLink}>
              Already have an account? 
              <Text style={styles.signInLinkBold}> Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </ImageBackground>
  );

  const renderPhoneInput = () => (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>Phone Number</Text>
      <View style={styles.phoneContainer}>
        <TouchableOpacity 
          style={styles.countryCodeButton}
          onPress={() => setShowCountryPicker(!showCountryPicker)}
        >
          <Text style={styles.countryCodeText}>
            {countryCodes.find(c => c.code === countryCode)?.flag} {countryCode}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.phoneInput}
          placeholder="712345678"
          placeholderTextColor="#999"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          autoCorrect={false}
        />
      </View>
      
      {showCountryPicker && (
        <View style={styles.countryPicker}>
          {countryCodes.map((country) => (
            <TouchableOpacity
              key={country.code}
              style={styles.countryOption}
              onPress={() => {
                setCountryCode(country.code);
                setShowCountryPicker(false);
              }}
            >
              <Text style={styles.countryOptionText}>
                {country.flag} {country.code} {country.country}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderForgotPasswordModal = () => (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Reset Password</Text>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={() => {
              setShowForgotPassword(false);
              setResetEmail('');
            }}
          >
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        <Text style={styles.modalDescription}>
          Enter your email address and we'll send you instructions to reset your password.
        </Text>

        <View style={styles.modalInputContainer}>
          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email address"
            placeholderTextColor="#999"
            value={resetEmail}
            onChangeText={setResetEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity 
          style={styles.resetButton}
          onPress={handleForgotPassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.resetButtonText}>Send Reset Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.cancelButton}
          onPress={() => {
            setShowForgotPassword(false);
            setResetEmail('');
          }}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPasswordInput = (
    value: string, 
    onChangeText: (text: string) => void, 
    placeholder: string, 
    showPassword: boolean, 
    toggleShow: () => void
  ) => (
    <View style={styles.passwordContainer}>
      <TextInput
        style={styles.passwordInput}
        placeholder={placeholder}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
      />
      <TouchableOpacity style={styles.eyeIcon} onPress={toggleShow}>
        <Ionicons 
          name={showPassword ? "eye" : "eye-off"} 
          size={20} 
          color="#999" 
        />
      </TouchableOpacity>
    </View>
  );

  const renderAuthForm = () => (
    <LinearGradient colors={['#FF6B35', '#F7931E']} style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Yetu Eats</Text>
            <View style={styles.logoIcon}>
              <Ionicons name="restaurant" size={24} color="#FF6B35" />
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            )}

            {!isLogin && renderPhoneInput()}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email address"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              {renderPasswordInput(
                password,
                setPassword,
                "Enter your password",
                showPassword,
                () => setShowPassword(!showPassword)
              )}
            </View>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm Password</Text>
                {renderPasswordInput(
                  confirmPassword,
                  setConfirmPassword,
                  "Confirm your password",
                  showConfirmPassword,
                  () => setShowConfirmPassword(!showConfirmPassword)
                )}
              </View>
            )}

            {isLogin && (
              <View style={styles.rememberMeContainer}>
                <TouchableOpacity 
                  style={styles.rememberMeButton}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && (
                      <Ionicons name="checkmark" size={16} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </TouchableOpacity>
              </View>
            )}

            {isLogin && (
              <TouchableOpacity 
                style={styles.forgotPassword}
                onPress={() => {
                  setResetEmail(email); // Pre-fill with current email
                  setShowForgotPassword(true);
                }}
              >
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                I read and agreed to <Text style={styles.termsLink}>User Agreement</Text> and{'\n'}
                <Text style={styles.termsLink}>privacy policy</Text>
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isLogin ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.socialContainer}>
              <Text style={styles.socialText}>
                {isLogin ? 'Sign in with' : 'Sign up with'}
              </Text>
              <TouchableOpacity 
                style={styles.socialButton}
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={24} color="#DB4437" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.switchButton}
              onPress={switchMode}
              disabled={loading}
            >
              <Text style={styles.switchButtonText}>
                {isLogin 
                  ? "Don't have an account? " 
                  : "Already have an account? "
                }
                <Text style={styles.switchButtonBold}>
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );

  if (showWelcome) {
    return renderWelcomeScreen();
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B35" />
      {renderAuthForm()}
      {showForgotPassword && renderForgotPasswordModal()}
    </>
  );
};

const styles = StyleSheet.create({
  // Welcome Screen Styles
  backgroundImage: {
    flex: 1,
    width: width,
    height: height,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  welcomeContainer: {
    alignItems: 'center',
    width: '100%',
  },
  welcomeTitle: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 50,
    opacity: 0.9,
  },
  getStartedButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 25,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  getStartedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },

  // Auth Form Styles
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 30,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginRight: 8,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B35',
  },
  formCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F9F9F9',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
  },
  passwordInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#F9F9F9',
    overflow: 'hidden',
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 15,
    borderRightWidth: 1,
    borderRightColor: '#E5E5E5',
    backgroundColor: '#F0F0F0',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    marginRight: 4,
  },
  phoneInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
  },
  countryPicker: {
    position: 'absolute',
    top: 75,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  countryOption: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  countryOptionText: {
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    paddingHorizontal: 15,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  rememberMeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  checkboxChecked: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#FF6B35',
    fontSize: 14,
    fontWeight: '500',
  },
  termsContainer: {
    marginBottom: 30,
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  termsLink: {
    color: '#FF6B35',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#FF6B35',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  socialContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  socialText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
  },
  socialButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  switchButton: {
    alignItems: 'center',
    paddingBottom: 30,
  },
  switchButtonText: {
    fontSize: 14,
    color: '#666',
  },
  switchButtonBold: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  signInLink: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  signInLinkBold: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Forgot Password Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    marginHorizontal: 20,
    width: width - 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  modalDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 25,
    textAlign: 'center',
  },
  modalInputContainer: {
    marginBottom: 25,
  },
  resetButton: {
    backgroundColor: '#FF6B35',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LoginScreen;