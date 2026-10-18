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
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// === 1. SECURITY HEADERS ===
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

// === 2. CORS WHITELIST - UPDATED FOR YOUR NEW VERCEL ===
const allowedOrigins = [
  'https://esosa-shop.vercel.app',
  'https://fullstack-orpin-three.vercel.app',
  'https://fullstack-lake-seven.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];
app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')){
      callback(null, true);
    } else {
      callback(new Error('CORS blocked - Not allowed'));
    }
  },
  methods: ['GET','POST','DELETE','PATCH'],
  allowedHeaders: ['Content-Type','x-auth-token'],
  credentials: true
}));

app.use(express.json({ limit: '10kb' }));
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// === 3. CHECK ENV ===
if(!process.env.MONGO_URI || !process.env.JWT_SECRET || !process.env.PAYSTACK_SECRET_KEY){
  console.error('❌ Missing ENV');
  process.exit(1);
}
if(process.env.JWT_SECRET.length < 20){
  console.error('❌ JWT_SECRET too weak');
  process.exit(1);
}

// === 4. MULTER SECURE ===
const storage = multer.diskStorage({
  destination: (req,file,cb) => cb(null, 'uploads/'),
  filename: (req,file,cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, Date.now() + '-' + safeName);
  }
});
const fileFilter = (req,file,cb) => {
  const allowed = ['image/jpeg','image/png','image/webp','image/jpg'];
  if(allowed.includes(file.mimetype)){
    cb(null, true);
  } else {
    cb(new Error('Only JPG/PNG/WEBP allowed - no backdoor files'), false);
  }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 2*1024*1024 }});

mongoose.connect(process.env.MONGO_URI).then(()=>console.log('MongoDB Secure Connected'));

// === 5. RATE LIMIT ===
const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: {msg:'Too many attempts'} });
const generalLimiter = rateLimit({ windowMs: 15*60*1000, max: 200 });
app.use(generalLimiter);

const User = mongoose.model('User', new mongoose.Schema({
  firstName: {type:String, trim:true, maxlength:50},
  lastName: {type:String, trim:true, maxlength:50},
  gender: String, country: String, phone: String,
  email: { type: String, unique: true, lowercase:true, trim:true },
  password: String,
  isAdmin: { type: Boolean, default: false }
}));

const Product = mongoose.model('Product', new mongoose.Schema({
  name: {type:String, required:true, trim:true, maxlength:100},
  category: {type:String, enum:['phones','laptops','shirts','watches','headphones','gaming','accessories']},
  description: {type:String, maxlength:500},
  price: {type:Number, min:0, max:100000},
  image: String
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  userId: String, userEmail: String, items: Array, total: {type:Number, min:0}, status: { type: String, default: 'Paid' }, paystackRef: String, email: String
}, { timestamps: true }));

const auth = (req,res,next)=>{
  const token = req.header('x-auth-token');
  if(!token) return res.status(401).json({msg:'No token'});
  try{
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  }catch{
    return res.status(401).json({msg:'Invalid token'});
  }
};

const isStrongPassword = (p)=>{
  if(p.length<8) return {ok:false, msg:'At least 8 chars'};
  if(!/[A-Z]/.test(p)) return {ok:false, msg:'1 Uppercase needed'};
  if(!/[a-z]/.test(p)) return {ok:false, msg:'1 lowercase needed'};
  if(!/[0-9]/.test(p)) return {ok:false, msg:'1 number needed'};
  if(!/[!@#$%^&*]/.test(p)) return {ok:false, msg:'1 special !@#$%^&* needed'};
  return {ok:true}
};

app.post('/api/auth/register', authLimiter, async (req,res)=>{
  try{
    const {firstName,lastName,gender,country,phone,email,password} = req.body;
    if(!email || !password) return res.status(400).json({msg:'Email and password required'});
    const check = isStrongPassword(password);
    if(!check.ok) return res.status(400).json({msg:check.msg});
    if(await User.findOne({email: email.toLowerCase()})) return res.status(400).json({msg:'User exists'});
    const hashed = await bcrypt.hash(password, 12);
    const isAdmin = email.toLowerCase() === 'esosa@test.com';
    const user = await User.create({firstName,lastName,gender,country,phone,email:email.toLowerCase(),password:hashed,isAdmin});
    const token = jwt.sign({id:user._id, isAdmin}, process.env.JWT_SECRET, {expiresIn:'7d'});
    res.json({token, user:{_id:user._id, email:user.email, isAdmin:user.isAdmin}});
  }catch(err){ res.status(500).json({msg:'Server error'}) }
});

app.post('/api/auth/login', authLimiter, async (req,res)=>{
  try{
    const {email,password} = req.body;
    const user = await User.findOne({email: email.toLowerCase()});
    if(!user) return res.status(400).json({msg:'Not found'});
    if(!await bcrypt.compare(password,user.password)) return res.status(400).json({msg:'Wrong password'});
    const token = jwt.sign({id:user._id, isAdmin:user.isAdmin}, process.env.JWT_SECRET, {expiresIn:'7d'});
    res.json({token, user:{_id:user._id, email:user.email, isAdmin:user.isAdmin}});
  }catch{ res.status(500).json({msg:'Server error'}) }
});

app.post('/api/auth/google', authLimiter, async (req,res)=>{
  try{
    const {email, firstName, lastName} = req.body;
    if(!email || !email.includes('@')) return res.status(400).json({msg:'Invalid email'});
    let user = await User.findOne({email: email.toLowerCase()});
    if(!user){
      user = await User.create({firstName: firstName||'Google', lastName: lastName||'User', email:email.toLowerCase(), password: await bcrypt.hash(Math.random().toString(36),10), isAdmin: email.toLowerCase()==='esosa@test.com'});
    }
    const token = jwt.sign({id:user._id, isAdmin:user.isAdmin}, process.env.JWT_SECRET, {expiresIn:'7d'});
    res.json({token, user:{_id:user._id, email:user.email, isAdmin:user.isAdmin}});
  }catch{ res.status(500).json({msg:'Google login failed'}) }
});

app.post('/api/upload', auth, upload.single('image'), (req,res)=>{
  if(req.user.isAdmin!==true) {
    if(req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({msg:'Admin only'});
  }
  if(!req.file) return res.status(400).json({msg:'No file'});
  res.json({path:`/uploads/${req.file.filename}`});
});

app.get('/api/products', async (req,res)=>{
  try{
    const {search, category} = req.query;
    let filter = {};
    if(search) filter.name = {$regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i'};
    if(category && category!=='All') filter.category = category;
    res.json(await Product.find(filter).limit(100));
  }catch{ res.status(500).json({msg:'Error'}) }
});

app.post('/api/products', auth, async (req,res)=>{
  try{
    if(!req.user.isAdmin) return res.status(403).json({msg:'Admin only'});
    const {name, category, description, price, image} = req.body;
    if(!name || !price) return res.status(400).json({msg:'Name and price required'});
    if(String(description).length > 500) return res.status(400).json({msg:'Description too long'});
    res.json(await Product.create({name, category, description, price:Number(price), image}));
  }catch{ res.status(500).json({msg:'Failed'}) }
});

app.delete('/api/products/:id', auth, async (req,res)=>{
  if(!req.user.isAdmin) return res.status(403).json({msg:'Admin only'});
  await Product.findByIdAndDelete(req.params.id);
  res.json({msg:'Deleted'});
});

app.post('/api/pay/verify', auth, async (req,res)=>{
  try{
    const {reference, items, total, email} = req.body;
    if(!reference) return res.status(400).json({msg:'Reference required'});
    const options = {
      hostname: 'api.paystack.co',
      path: `/transaction/verify/${encodeURIComponent(reference)}`,
      method: 'GET',
      headers: {Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`}
    };
    const payReq = https.request(options, payRes=>{
      let data=''; payRes.on('data', d=>data+=d);
      payRes.on('end', async ()=>{
        try{
          const result = JSON.parse(data);
          if(result.data && result.data.status==='success' && result.data.amount >= total*100 - 100){
            const order = await Order.create({userId:req.user.id, userEmail:email, email, items, total, paystackRef:reference, status:'Paid'});
            return res.json(order);
          } else {
            return res.status(400).json({msg:'Payment not verified'});
          }
        }catch{ return res.status(400).json({msg:'Verify parse error'}) }
      });
    });
    payReq.on('error', ()=> res.status(400).json({msg:'Paystack network error'}));
    payReq.end();
  }catch{ res.status(500).json({msg:'Verify failed'}) }
});

app.get('/api/orders/my', auth, async (req,res)=> res.json(await Order.find({userId:req.user.id}).sort({createdAt:-1})));

app.get('/api/orders/all', auth, async (req,res)=>{
  if(req.user.isAdmin!==true) return res.status(403).json({msg:'Admin only'});
  res.json(await Order.find().sort({createdAt:-1}));
});

// === NEW ROUTES - ORDER DETAILS + DELETE ORDER ===
app.get('/api/orders/:id', auth, async (req,res)=>{
  try{
    const order = await Order.findById(req.params.id);
    if(!order) return res.status(404).json({msg:'Order not found'});
    // User can see own order, admin can see all
    if(order.userId !== req.user.id && req.user.isAdmin !== true){
      return res.status(403).json({msg:'Not your order'});
    }
    res.json(order);
  }catch{ res.status(500).json({msg:'Error fetching order'}) }
});

app.delete('/api/orders/:id', auth, async (req,res)=>{
  try{
    if(req.user.isAdmin!==true) return res.status(403).json({msg:'Admin only'});
    await Order.findByIdAndDelete(req.params.id);
    res.json({msg:'Order deleted ✅'});
  }catch{ res.status(500).json({msg:'Delete failed'}) }
});

app.get('/', (req,res)=> res.send('Esosa API Secure Live - Delete + Details Added ✅'));

// === ERROR HANDLER ===
app.use((err, req, res, next)=>{
  if(err.type === 'entity.too.large' || err.status === 413 || err.message.includes('too large')){
    return res.status(413).json({msg:'Payload too large - Max 10kb blocked'});
  }
  if(err.message && err.message.includes('Only JPG')){
    return res.status(400).json({msg: err.message});
  }
  if(err.message && err.message.includes('CORS')){
    return res.status(403).json({msg: err.message});
  }
  console.error('Error:', err.message);
  res.status(500).json({msg:'Something went wrong'});
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=> console.log(`🔒 SECURE Server Live on ${PORT} - Delete + Order Details Ready ✅`));