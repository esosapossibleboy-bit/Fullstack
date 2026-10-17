require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// === CREATE UPLOADS FOLDER ===
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// === MULTER SETUP - Upload from Phone/Laptop ===
const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, 'uploads/'),
  filename: (req,file,cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g,''))
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req,file,cb) => {
    if(file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'), false);
  }
});

// === MONGO CONNECT ===
mongoose.connect(process.env.MONGO_URI).then(()=>console.log('MongoDB Connected'));

// === MODELS ===
const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, unique: true },
  password: String,
  isAdmin: { type: Boolean, default: false }
}));

const Product = mongoose.model('Product', new mongoose.Schema({
  name: String, price: Number, image: String, description: String
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  userId: String, userEmail: String, items: Array, total: Number, status: { type: String, default: 'Pending' }
}, { timestamps: true }));

// === MIDDLEWARE ===
const auth = (req,res,next)=>{
  const token = req.header('x-auth-token');
  if(!token) return res.status(401).json({msg:'No token'});
  try{
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'esosa_secret');
    next();
  }catch{ res.status(401).json({msg:'Invalid token'}) }
};

// === STRONG PASSWORD POLICY ===
const isStrongPassword = (password) => {
  if (password.length < 8) return { ok: false, msg: 'Password must be at least 8 characters' };
  if (!/[A-Z]/.test(password)) return { ok: false, msg: 'Password must include 1 Uppercase letter (A-Z)' };
  if (!/[a-z]/.test(password)) return { ok: false, msg: 'Password must include 1 lowercase letter (a-z)' };
  if (!/[0-9]/.test(password)) return { ok: false, msg: 'Password must include 1 number (0-9)' };
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return { ok: false, msg: 'Password must include 1 special char (!@#$%^&*)' };
  return { ok: true };
};

// === ROUTES ===

// Auth
app.post('/api/auth/register', async (req,res)=>{
  const {email,password} = req.body;
  const check = isStrongPassword(password);
  if (!check.ok) return res.status(400).json({msg: check.msg});

  const exists = await User.findOne({email});
  if(exists) return res.status(400).json({msg:'User exists'});
  
  const hashed = await bcrypt.hash(password,10);
  const isAdmin = email === 'esosa@test.com';
  const user = await User.create({email, password:hashed, isAdmin});
  const token = jwt.sign({id:user._id, isAdmin:user.isAdmin}, process.env.JWT_SECRET || 'esosa_secret');
  res.json({token, user:{_id:user._id, email, isAdmin:user.isAdmin}});
});

app.post('/api/auth/login', async (req,res)=>{
  const {email,password} = req.body;
  const user = await User.findOne({email});
  if(!user) return res.status(400).json({msg:'Not found'});
  const ok = await bcrypt.compare(password, user.password);
  if(!ok) return res.status(400).json({msg:'Wrong password'});
  const token = jwt.sign({id:user._id, isAdmin:user.isAdmin}, process.env.JWT_SECRET || 'esosa_secret');
  res.json({token, user:{_id:user._id, email:user.email, isAdmin:user.isAdmin}});
});

// === UPLOAD IMAGE FROM PHONE/LAPTOP - NEW! ===
app.post('/api/upload', auth, upload.single('image'), (req,res)=>{
  if(req.user.isAdmin !== true) return res.status(403).json({msg:'Admin only'});
  if(!req.file) return res.status(400).json({msg:'No file uploaded'});
  
  // This URL works both localhost and Render
  const imagePath = `/uploads/${req.file.filename}`;
  const fullUrl = `${req.protocol}://${req.get('host')}${imagePath}`;
  
  res.json({ 
    msg: 'Uploaded', 
    path: imagePath,          // Use this: /uploads/123.jpg
    imageUrl: fullUrl,        // Full URL for preview
    localPath: `${process.env.API_URL || ''}${imagePath}` 
  });
});

// Products
app.get('/api/products', async (req,res)=> res.json(await Product.find()));
app.post('/api/products', auth, async (req,res)=>{
  if(!req.user.isAdmin) return res.status(403).json({msg:'Admin only'});
  res.json(await Product.create(req.body));
});

// Orders
app.post('/api/orders', auth, async (req,res)=>{
  const {items,total,email} = req.body;
  const order = await Order.create({userId:req.user.id, userEmail:email, items, total});
  res.json(order);
});
app.get('/api/orders/my', auth, async (req,res)=> res.json(await Order.find({userId:req.user.id})));
app.get('/api/orders/all', auth, async (req,res)=>{
  if(req.user.isAdmin !== true) return res.status(403).json({msg:'Admin only - isAdmin false'});
  res.json(await Order.find());
});

app.get('/', (req,res)=> res.send('Esosa API Live - Strong Password + File Upload'));

app.listen(process.env.PORT || 5000, ()=> console.log('Server running with Upload'));