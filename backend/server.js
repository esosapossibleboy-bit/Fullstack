require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','DELETE','PUT'], allowedHeaders: ['Content-Type','x-auth-token'] }));
app.use(express.json());
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, 'uploads/'),
  filename: (req,file,cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s/g,''))
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 }});

mongoose.connect(process.env.MONGO_URI).then(()=>console.log('MongoDB Connected'));

const User = mongoose.model('User', new mongoose.Schema({
  firstName: String, lastName: String, gender: String, country: String, phone: String,
  email: { type: String, unique: true },
  password: String,
  isAdmin: { type: Boolean, default: false }
}));

const Product = mongoose.model('Product', new mongoose.Schema({
  name: String, category: String, description: String, price: Number, image: String
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  userId: String, userEmail: String, items: Array, total: Number, status: { type: String, default: 'Paid' }, paystackRef: String
}, { timestamps: true }));

const auth = (req,res,next)=>{
  const token = req.header('x-auth-token');
  if(!token) return res.status(401).json({msg:'No token'});
  try{ req.user = jwt.verify(token, process.env.JWT_SECRET || 'esosa_secret'); next(); }catch{ res.status(401).json({msg:'Invalid token'}) }
};

const isStrongPassword = (p)=>{
  if(p.length<8) return {ok:false, msg:'At least 8 chars'}; 
  if(!/[A-Z]/.test(p)) return {ok:false, msg:'1 Uppercase needed'};
  if(!/[a-z]/.test(p)) return {ok:false, msg:'1 lowercase needed'};
  if(!/[0-9]/.test(p)) return {ok:false, msg:'1 number needed'};
  if(!/[!@#$%^&*]/.test(p)) return {ok:false, msg:'1 special !@#$%^&* needed'};
  return {ok:true}
};

// Auth
app.post('/api/auth/register', async (req,res)=>{
  const {firstName,lastName,gender,country,phone,email,password} = req.body;
  const check = isStrongPassword(password);
  if(!check.ok) return res.status(400).json({msg:check.msg});
  if(await User.findOne({email})) return res.status(400).json({msg:'User exists'});
  const hashed = await bcrypt.hash(password,10);
  const isAdmin = email==='esosa@test.com';
  const user = await User.create({firstName,lastName,gender,country,phone,email,password:hashed,isAdmin});
  const token = jwt.sign({id:user._id, isAdmin}, process.env.JWT_SECRET || 'esosa_secret');
  res.json({token, user});
});

app.post('/api/auth/login', async (req,res)=>{
  const {email,password} = req.body;
  const user = await User.findOne({email});
  if(!user) return res.status(400).json({msg:'Not found'});
  if(!await bcrypt.compare(password,user.password)) return res.status(400).json({msg:'Wrong password'});
  const token = jwt.sign({id:user._id, isAdmin:user.isAdmin}, process.env.JWT_SECRET || 'esosa_secret');
  res.json({token, user});
});

// Google Signup (simple - creates user from Google email)
app.post('/api/auth/google', async (req,res)=>{
  const {email, firstName, lastName} = req.body;
  let user = await User.findOne({email});
  if(!user){
    user = await User.create({firstName, lastName, email, password: await bcrypt.hash(Math.random().toString(),10), isAdmin: email==='esosa@test.com'});
  }
  const token = jwt.sign({id:user._id, isAdmin:user.isAdmin}, process.env.JWT_SECRET || 'esosa_secret');
  res.json({token, user});
});

// Upload
app.post('/api/upload', auth, upload.single('image'), (req,res)=>{
  if(req.user.isAdmin!==true) return res.status(403).json({msg:'Admin only'});
  res.json({path:`/uploads/${req.file.filename}`});
});

// Products
app.get('/api/products', async (req,res)=>{
  const {search, category} = req.query;
  let filter = {};
  if(search) filter.name = {$regex: search, $options: 'i'};
  if(category && category!=='All') filter.category = category;
  res.json(await Product.find(filter));
});
app.post('/api/products', auth, async (req,res)=>{
  if(!req.user.isAdmin) return res.status(403).json({msg:'Admin only'});
  res.json(await Product.create(req.body));
});
app.delete('/api/products/:id', auth, async (req,res)=>{
  if(!req.user.isAdmin) return res.status(403).json({msg:'Admin only'});
  await Product.findByIdAndDelete(req.params.id);
  res.json({msg:'Deleted'});
});
app.delete('/api/products/clean/duplicates', auth, async (req,res)=>{
  if(!req.user.isAdmin) return res.status(403).json({msg:'Admin only'});
  const products = await Product.find();
  const seen = new Map(); let deleted=0;
  for(const p of products){ if(seen.has(p.name)){ await Product.findByIdAndDelete(p._id); deleted++; } else seen.set(p.name,true); }
  res.json({msg:`Cleaned ${deleted}`});
});

// Paystack Verify
app.post('/api/pay/verify', auth, async (req,res)=>{
  const {reference, items, total, email} = req.body;
  // Verify with Paystack secret key
  const options = { hostname: 'api.paystack.co', path: `/transaction/verify/${reference}`, method: 'GET', headers: {Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`}};
  const payReq = https.request(options, payRes=>{
    let data=''; payRes.on('data', d=>data+=d); payRes.on('end', async ()=>{
      const result = JSON.parse(data);
      if(result.data && result.data.status==='success'){
        const order = await Order.create({userId:req.user.id, userEmail:email, items, total, paystackRef:reference, status:'Paid'});
        res.json(order);
      } else res.status(400).json({msg:'Payment not verified'});
    });
  });
  payReq.on('error', ()=>res.status(400).json({msg:'Verify error - still create order for test',}));
  payReq.end();
  // Fallback for testing without Paystack key
  if(!process.env.PAYSTACK_SECRET_KEY){
    const order = await Order.create({userId:req.user.id, userEmail:email, items, total, paystackRef:reference, status:'Paid (Test)'});
    return res.json(order);
  }
});

app.get('/api/orders/my', auth, async (req,res)=> res.json(await Order.find({userId:req.user.id})));
app.get('/api/orders/all', auth, async (req,res)=>{
  if(req.user.isAdmin!==true) return res.status(403).json({msg:'Admin only'});
  res.json(await Order.find());
});

app.get('/', (req,res)=> res.send('Esosa API PRO Live'));
app.listen(process.env.PORT || 5000, ()=> console.log('PRO Server Live'));