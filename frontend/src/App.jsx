import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'https://esosa-fullstack.onrender.com';
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_KEY;

if(!PAYSTACK_PUBLIC_KEY){
  console.warn("⚠️ Missing VITE_PAYSTACK_KEY");
}

const AuthContext = createContext();
const CartContext = createContext();

function ProtectedRoute({ children, adminOnly }){
  const { user } = useContext(AuthContext);
  if(!user) return <Navigate to="/login" replace />;
  if(adminOnly && user.isAdmin !== true) return <h2 style={{padding:30}}>❌ Admin Only - esosa@test.com</h2>;
  return children;
}

function checkPasswordStrength(pwd){
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[!@#$%^&*]/.test(pwd),
  };
}

const sanitize = (str) => {
  if(!str) return '';
  return String(str).replace(/[<>\"']/g, '').trim().slice(0, 100);
};

function Store(){
  const [products,setProducts] = useState([]);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('All');
  const { addToCart } = useContext(CartContext);

  const fetchProducts = async () => {
    try {
      const q = `?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`;
      const res = await fetch(`${API}/api/products${q}`);
      const data = await res.json();
      if(!Array.isArray(data)) return;
      const unique = [...new Map(data.map(p => [p.name, p])).values()];
      setProducts(unique);
    } catch { setProducts([]); }
  };

  useEffect(()=>{ fetchProducts(); },[search, category]);
  const categories = ['All','phones','laptops','shirts','watches','headphones','gaming','accessories'];

  return (
    <div style={{padding:20}}>
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value.slice(0,50))} placeholder="🔍 Search products..." style={{padding:10, width:300, borderRadius:8, border:'1px solid #ccc'}} maxLength={50}/>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{padding:10, borderRadius:8}}>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:15}}>
        {products.map(p=>(
          <div key={p._id} style={{border:'1px solid #ddd', padding:12, borderRadius:12, background:'white'}}>
            <img src={p.image?.startsWith('/uploads') ? `${API}${p.image}` : (p.image?.startsWith('https://') ? p.image : '')} onError={(e)=> e.target.style.display='none'} style={{width:'100%', height:180, objectFit:'cover', borderRadius:8}} alt={sanitize(p.name)} />
            <span style={{fontSize:11, background:'#eee', padding:'2px 6px', borderRadius:4}}>{sanitize(p.category)}</span>
            <h3 style={{margin:'6px 0'}}>{sanitize(p.name)}</h3>
            <p style={{fontSize:13, color:'#555', minHeight:40}}>{sanitize(p.description) || 'No description'}</p>
            <p><b>${Number(p.price) || 0}</b></p>
            <button onClick={()=>addToCart(p)} style={{width:'100%', padding:8, background:'black', color:'white', borderRadius:6, cursor:'pointer'}}>Add to Cart</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Login(){
  const [email,setEmail]=useState(''); const [pass,setPass]=useState('');
  const [loading,setLoading]=useState(false); const [attempts,setAttempts]=useState(0);
  const { setUser } = useContext(AuthContext); const nav=useNavigate();
  const submit=async(e)=>{
    e.preventDefault();
    if(attempts >= 5) return alert('Too many attempts. Wait 5 mins');
    setLoading(true);
    try {
      const res=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.toLowerCase().trim(),password:pass})});
      const data=await res.json();
      if(data.token){ localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); nav('/'); } 
      else { setAttempts(a=>a+1); alert(data.msg || 'Login failed'); }
    } catch { alert('Network error'); }
    setLoading(false);
  };
  const googleLogin = async () => {
    const googleEmail = prompt('Enter Google Email:');
    if(!googleEmail || !googleEmail.includes('@')) return alert('Invalid Gmail');
    try {
      const res = await fetch(`${API}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:googleEmail.toLowerCase().trim(), firstName:'Google', lastName:'User'})});
      const data = await res.json();
      if(data.token){ localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); nav('/'); }
    } catch { alert('Google login failed'); }
  };
  return (
    <form onSubmit={submit} style={{maxWidth:400, margin:'30px auto', padding:20, border:'1px solid #ddd', borderRadius:12, display:'flex', flexDirection:'column', gap:10, background:'white'}}>
      <h2>Login</h2>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" required type="email"/>
      <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="password" required/>
      <button disabled={loading || attempts>=5}>{loading?'Loading...':'Login'}</button>
      <div style={{textAlign:'center', color:'#888', fontSize:13}}>OR</div>
      <button type="button" onClick={googleLogin} style={{width:'100%', background:'white', color:'#444', border:'1px solid #ccc', padding:'10px', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontWeight:600, cursor:'pointer'}}>
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="google" style={{width:20, height:20}} />
        Continue with Google
      </button>
    </form>
  );
}

function Register(){
  const [form,setForm]=useState({firstName:'',lastName:'',gender:'Male',country:'Nigeria',phone:'',email:'',password:''});
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const nav=useNavigate();
  const { setUser } = useContext(AuthContext);
  const strength = checkPasswordStrength(form.password);
  const isStrong = Object.values(strength).every(v=>v===true);
  const handle = (k,v) => setForm({...form,[k]:v.slice(0,100)});

  const submit=async(e)=>{
    e.preventDefault();
    if(!isStrong){ setError('Weak password - need 8+ chars, Big letter, small, number, symbol'); return; }
    if(!form.email.includes('@')){ setError('Invalid email'); return; }
    setLoading(true);
    try {
      const res=await fetch(`${API}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form, email:form.email.toLowerCase().trim()})});
      const data=await res.json();
      if(data.token){ alert('Registered! ✅'); nav('/login'); } else { setError(data.msg || 'Failed'); }
    } catch { setError('Network error'); }
    setLoading(false);
  };

  const googleLogin = async () => {
    const googleEmail = prompt('Enter Google Email:');
    if(!googleEmail || !googleEmail.includes('@') || googleEmail.length > 100) return alert('Invalid Gmail');
    try {
      const res = await fetch(`${API}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:googleEmail.toLowerCase().trim(), firstName:'Google', lastName:'User'})});
      const data = await res.json();
      if(data.token){
        localStorage.setItem('token',data.token); 
        localStorage.setItem('user',JSON.stringify(data.user)); 
        setUser(data.user); 
        nav('/');
      } else alert(data.msg || 'Google register failed');
    } catch { alert('Google login failed'); }
  };

  return (
    <form onSubmit={submit} className="form" style={{maxWidth:420, margin:'20px auto', padding:20, border:'1px solid #ddd', borderRadius:12, display:'flex', flexDirection:'column', gap:8, background:'white'}}>
      <h2>Create Account</h2>
      <div style={{display:'flex', gap:8}}><input value={form.firstName} onChange={e=>handle('firstName',e.target.value)} placeholder="First Name" required maxLength={50}/><input value={form.lastName} onChange={e=>handle('lastName',e.target.value)} placeholder="Last Name" required maxLength={50}/></div>
      <div style={{display:'flex', gap:8}}>
        <select value={form.gender} onChange={e=>handle('gender',e.target.value)} style={{flex:1, padding:8}}><option>Male</option><option>Female</option><option>Other</option></select>
        <input value={form.country} onChange={e=>handle('country',e.target.value)} placeholder="Country" required maxLength={50} style={{flex:1}}/>
      </div>
      <input value={form.phone} onChange={e=>handle('phone',e.target.value)} placeholder="Phone +234..." required maxLength={20}/>
      <input value={form.email} onChange={e=>handle('email',e.target.value)} placeholder="Email" required type="email" maxLength={100}/>
      <input type="password" value={form.password} onChange={e=>handle('password',e.target.value)} placeholder="Password" required maxLength={100}/>
      {form.password && (
        <div style={{fontSize:'12px', lineHeight:'1.6'}}>
          <div style={{color: strength.length ? 'green' : 'red'}}>{strength.length ? '✅' : '❌'} 8+ chars</div>
          <div style={{color: strength.upper ? 'green' : 'red'}}>{strength.upper ? '✅' : '❌'} Uppercase</div>
          <div style={{color: strength.lower ? 'green' : 'red'}}>{strength.lower ? '✅' : '❌'} lowercase</div>
          <div style={{color: strength.number ? 'green' : 'red'}}>{strength.number ? '✅' : '❌'} Number</div>
          <div style={{color: strength.special ? 'green' : 'red'}}>{strength.special ? '✅' : '❌'} Special !@#$%</div>
        </div>
      )}
      {error && <p style={{color:'red', fontSize:13}}>{error}</p>}
      <button disabled={!isStrong || loading} style={{opacity: isStrong ? 1 : 0.5, background: isStrong ? 'black' : '#888', color:'white', padding:10, borderRadius:6, cursor: isStrong ? 'pointer' : 'not-allowed'}}>{loading?'Creating...': isStrong ? 'Register ✅' : 'Weak Password ❌'}</button>
      <div style={{textAlign:'center', color:'#888', fontSize:13, marginTop:5}}>OR</div>
      <button type="button" onClick={googleLogin} style={{width:'100%', background:'white', color:'#444', border:'1px solid #ccc', padding:'10px', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontWeight:600, cursor:'pointer'}}>
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="google" style={{width:20, height:20}} />
        Continue with Google
      </button>
    </form>
  )
}

function Cart(){
  const { cart, remove } = useContext(CartContext); const { user } = useContext(AuthContext); const nav=useNavigate();
  const total = cart.reduce((s,i)=>s+ (Number(i.price) || 0),0);
  const payWithPaystack = () => {
    if(total <=0) return alert('Cart empty');
    if(!PAYSTACK_PUBLIC_KEY) return alert('Paystack key missing');
    if(!window.PaystackPop){ const s=document.createElement('script'); s.src='https://js.paystack.co/v1/inline.js'; document.body.appendChild(s); setTimeout(()=>payWithPaystack(),1500); return; }
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY, email: user.email, amount: total*100, currency: 'NGN', ref: 'ESOSA_'+Date.now(),
      callback: async function(response){
        const res = await fetch(`${API}/api/pay/verify`,{method:'POST',headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},body:JSON.stringify({reference: response.reference, items: cart, total, email: user.email})});
        const data = await res.json();
        if(res.ok){ alert('Payment Success! ✅ Ref: '+response.reference); nav('/myorders'); }
        else alert(data.msg || 'Verify failed');
      },
      onClose: function(){ console.log('closed'); }
    }); handler.openIframe();
  };
  return (
    <div style={{padding:20}}>
      <h2>Cart - ${total}</h2>
      {cart.map((c,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:8, background:'white', marginBottom:4, borderRadius:6}}><span>{sanitize(c.name)} - ${Number(c.price)||0}</span><button onClick={()=>remove(i)}>x</button></div>)}
      {cart.length>0 ? <><button onClick={payWithPaystack} style={{marginTop:20, padding:12, background:'#0AA', color:'white', width:'100%', borderRadius:8, fontSize:16, cursor:'pointer', border:'none'}}>💳 Pay with Paystack - ${total}</button><p style={{fontSize:12, color:'#666'}}>Test card: 4084084084084081</p></> : <p>Cart empty</p>}
    </div>
  )
}

function MyOrders(){
  const [orders,setOrders]=useState([]);
  useEffect(()=>{ fetch(`${API}/api/orders/my`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=> Array.isArray(d)? setOrders(d): setOrders([])).catch(()=> setOrders([])); },[]);
  return <div style={{padding:20}}><h2>My Orders</h2>{orders.map(o=><div key={o._id} style={{border:'1px solid #ddd', padding:10, marginBottom:8, borderRadius:8, background:'white'}}>{Number(o.total)||0}$ - {sanitize(o.status)} - {o.items?.length || 0} items - Ref: {sanitize(o.paystackRef)}</div>)}</div>
}

function Admin(){
  const [orders,setOrders]=useState([]); const [name,setName]=useState(''); const [price,setPrice]=useState(''); const [image,setImage]=useState(''); const [category,setCategory]=useState('phones'); const [desc,setDesc]=useState(''); const [uploading,setUploading]=useState(false);
  useEffect(()=>{ fetch(`${API}/api/orders/all`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=>Array.isArray(d)?setOrders(d):setOrders([])).catch(()=> setOrders([])); },[]);
  const handleFileUpload = async (e) => {
    const f = e.target.files[0]; if(!f) return;
    if(f.size > 2*1024*1024) return alert('Max 2MB');
    setUploading(true);
    const fd = new FormData(); fd.append('image', f);
    try{ const res = await fetch(`${API}/api/upload`,{method:'POST',headers:{'x-auth-token':localStorage.getItem('token')},body:fd}); const data = await res.json(); if(data.path){ setImage(`${API}${data.path}`); alert('Uploaded ✅'); } else alert(data.msg || 'Upload failed'); }catch{ alert('Upload error') }
    setUploading(false);
  };
  const addProduct=async(e)=>{
    e.preventDefault(); 
    if(!image) return alert('Upload image first');
    try {
      const res = await fetch(`${API}/api/products`,{method:'POST',headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},body:JSON.stringify({name: sanitize(name), price:Number(price), image, category, description: sanitize(desc)})});
      const data = await res.json(); 
      if(data._id){ alert('Product Added ✅'); setName('');setPrice('');setImage('');setDesc(''); } else alert(data.msg || 'Failed');
    } catch { alert('Add failed'); }
  };
  const totalSales = orders.reduce((s,o)=>s+ (Number(o.total) || 0),0);
  return (
    <div style={{padding:20}}>
      <h2>Admin - Orders ({orders.length}) - Sales ${totalSales}</h2>
      <form onSubmit={addProduct} style={{border:'2px dashed #888', padding:15, maxWidth:450, borderRadius:12, background:'white'}}>
        <h3>Add Product</h3>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Product Name" required/>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{padding:8, margin:'6px 0'}}><option value="phones">phones</option><option value="laptops">laptops</option><option value="shirts">shirts</option><option value="watches">watches</option><option value="headphones">headphones</option><option value="gaming">gaming</option><option value="accessories">accessories</option></select>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description" required/>
        <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price" type="number" required/>
        <div style={{background:'#f5f5f5', padding:10, margin:'10px 0', borderRadius:8}}><label><b>📁 Upload (Max 2MB)</b></label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload}/>{uploading && <p>Uploading...</p>}</div>
        <input value={image} onChange={e=>setImage(e.target.value)} placeholder="Image URL"/>
        {image && <img src={image} alt="preview" style={{width:120, height:120, objectFit:'cover', marginTop:8}}/>}
        <button type="submit" style={{marginTop:10}}>Add Product</button>
      </form>
    </div>
  )
}

export default function App(){
  const [user,setUser]=useState(()=>{ try{ const u=JSON.parse(localStorage.getItem('user')); return u && u.email ? u : null }catch{return null} });
  const [cart,setCart]=useState([]);
  const addToCart=(p)=>{ if(cart.length >=20) return alert('Max 20 items'); setCart([...cart,p]); };
  const remove=(i)=>setCart(cart.filter((_,idx)=>idx!==i));
  const isAdmin = user?.isAdmin === true;
  useEffect(()=>{ const script = document.createElement('script'); script.src = 'https://js.paystack.co/v1/inline.js'; document.body.appendChild(script); },[]);
  return (
    <AuthContext.Provider value={{user,setUser}}><CartContext.Provider value={{cart,addToCart,remove}}>
      <BrowserRouter>
        <nav style={{display:'flex', gap:12, padding:12, background:'black', color:'white', alignItems:'center', flexWrap:'wrap'}}>
          <Link to="/" style={{color:'white', fontWeight:'bold'}}>EsosaTech</Link>
          <Link to="/" style={{color:'white'}}>Store</Link>
          <Link to="/cart" style={{color:'white'}}>Cart ({cart.length})</Link>
          {user && <Link to="/myorders" style={{color:'white'}}>My Orders</Link>}
          {isAdmin && <Link to="/admin" style={{background:'gold', color:'black', padding:'4px 8px', borderRadius:6}}>Admin 👑</Link>}
          {!user ? <><Link to="/login" style={{color:'white'}}>Login</Link><Link to="/register" style={{color:'white'}}>Register</Link></> : <><span>{user.email}</span><button onClick={()=>{localStorage.clear();setUser(null); window.location='/';}}>Logout</button></>}
        </nav>
        <Routes>
          <Route path="/" element={<Store/>}/>
          <Route path="/login" element={<Login/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/cart" element={<ProtectedRoute><Cart/></ProtectedRoute>}/>
          <Route path="/myorders" element={<ProtectedRoute><MyOrders/></ProtectedRoute>}/>
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin/></ProtectedRoute>}/>
        </Routes>
      </BrowserRouter>
    </CartContext.Provider></AuthContext.Provider>
  );
}