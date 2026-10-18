import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './App.css';

const API = 'https://esosa-fullstack.onrender.com';

// === PAYSTACK PUBLIC KEY - REPLACE WITH YOURS ===
const PAYSTACK_PUBLIC_KEY = 'pk_test_xxxxxxxxxx'; // get from paystack dashboard

// === CONTEXTS ===
const AuthContext = createContext();
const CartContext = createContext();

function ProtectedRoute({ children, adminOnly }){
  const { user } = useContext(AuthContext);
  if(!user) return <Navigate to="/login" />;
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

// === STORE WITH SEARCH + CATEGORY + DELETE ===
function Store(){
  const [products,setProducts] = useState([]);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('All');
  const { addToCart } = useContext(CartContext);
  const { user } = useContext(AuthContext);
  const isAdmin = user?.isAdmin;

  const fetchProducts = async () => {
    const q = `?search=${search}&category=${category}`;
    const res = await fetch(`${API}/api/products${q}`);
    const data = await res.json();
    // remove duplicates
    const unique = [...new Map(data.map(p => [p.name, p])).values()];
    setProducts(unique);
  };

  useEffect(()=>{ fetchProducts(); },[search, category]);

  const deleteProduct = async (id) => {
    if(!confirm('Delete this product?')) return;
    await fetch(`${API}/api/products/${id}`, { method:'DELETE', headers:{'x-auth-token':localStorage.getItem('token')}});
    fetchProducts();
  };

  const categories = ['All','phones','laptops','shirts','watches','headphones','gaming','accessories'];

  return (
    <div style={{padding:20}}>
      {/* SEARCH BAR */}
      <div style={{display:'flex', gap:10, marginBottom:20, flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search products..." style={{padding:10, width:300, borderRadius:8, border:'1px solid #ccc'}}/>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{padding:10, borderRadius:8}}>
          {categories.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:15}}>
        {products.map(p=>(
          <div key={p._id} className="card" style={{border:'1px solid #ddd', padding:12, borderRadius:12}}>
            <img src={p.image?.startsWith('/uploads') ? `${API}${p.image}` : p.image} crossOrigin="anonymous" style={{width:'100%', height:180, objectFit:'cover', borderRadius:8}} />
            <span style={{fontSize:11, background:'#eee', padding:'2px 6px', borderRadius:4}}>{p.category}</span>
            <h3 style={{margin:'6px 0'}}>{p.name}</h3>
            <p style={{fontSize:13, color:'#555', minHeight:40}}>{p.description || 'No description'}</p>
            <p><b>${p.price}</b></p>
            <button onClick={()=>addToCart(p)} style={{width:'100%', padding:8, background:'black', color:'white', borderRadius:6}}>Add to Cart</button>
            {isAdmin && <button onClick={()=>deleteProduct(p._id)} style={{width:'100%', marginTop:6, padding:6, background:'red', color:'white', borderRadius:6}}>🗑 Delete</button>}
          </div>
        ))}
      </div>
      {products.length===0 && <p>No products found for "{search}"</p>}
    </div>
  );
}

function Login(){
  const [email,setEmail]=useState(''); const [pass,setPass]=useState('');
  const { setUser } = useContext(AuthContext); const nav=useNavigate();
  const submit=async(e)=>{
    e.preventDefault();
    const res=await fetch(`${API}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
    const data=await res.json();
    if(data.token){ localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); nav('/'); }
    else alert(data.msg);
  };
  const googleLogin = async () => {
    const googleEmail = prompt('Enter Google Email (For demo, paste your gmail):');
    if(!googleEmail) return;
    const res = await fetch(`${API}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:googleEmail, firstName:'Google', lastName:'User'})});
    const data = await res.json();
    localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); nav('/');
  };
  return (
    <form onSubmit={submit} className="form" style={{maxWidth:400, margin:'30px auto', padding:20, border:'1px solid #ddd', borderRadius:12}}>
      <h2>Login</h2>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" required/>
      <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="password" required/>
      <button style={{width:'100%', marginTop:10}}>Login</button>
      <button type="button" onClick={googleLogin} style={{width:'100%', marginTop:10, background:'white', color:'black', border:'1px solid #ccc'}}>🔵 Continue with Google</button>
    </form>
  );
}

function Register(){
  const [form,setForm]=useState({firstName:'',lastName:'',gender:'Male',country:'Nigeria',phone:'',email:'',password:''});
  const [error,setError]=useState(''); const nav=useNavigate();
  const strength = checkPasswordStrength(form.password);
  const isStrong = Object.values(strength).every(v=>v===true);
  const handle = (k,v) => setForm({...form,[k]:v});

  const submit=async(e)=>{
    e.preventDefault();
    if(!isStrong){ setError('Weak password - check requirements'); return; }
    const res=await fetch(`${API}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
    const data=await res.json();
    if(data.token){ alert('Registered! ✅'); nav('/login'); } else { setError(data.msg); }
  };

  const googleSignup = async () => {
    const googleEmail = prompt('Enter Gmail for Google Signup:');
    if(!googleEmail) return;
    const res = await fetch(`${API}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:googleEmail, firstName:form.firstName || 'Google', lastName:form.lastName || 'User'})});
    const data = await res.json();
    if(data.token){ alert('Google Signup success! ✅'); nav('/login'); }
  };

  return (
    <form onSubmit={submit} className="form" style={{maxWidth:420, margin:'20px auto', padding:20, border:'1px solid #ddd', borderRadius:12, display:'flex', flexDirection:'column', gap:8}}>
      <h2>Create Account</h2>
      <div style={{display:'flex', gap:8}}><input value={form.firstName} onChange={e=>handle('firstName',e.target.value)} placeholder="First Name" required style={{flex:1}}/><input value={form.lastName} onChange={e=>handle('lastName',e.target.value)} placeholder="Last Name" required style={{flex:1}}/></div>
      <div style={{display:'flex', gap:8}}>
        <select value={form.gender} onChange={e=>handle('gender',e.target.value)} style={{flex:1, padding:8}}><option>Male</option><option>Female</option><option>Other</option></select>
        <input value={form.country} onChange={e=>handle('country',e.target.value)} placeholder="Country" required style={{flex:1}}/>
      </div>
      <input value={form.phone} onChange={e=>handle('phone',e.target.value)} placeholder="Phone Number +234..." required/>
      <input value={form.email} onChange={e=>handle('email',e.target.value)} placeholder="Email" required/>
      <input type="password" value={form.password} onChange={e=>handle('password',e.target.value)} placeholder="Password" required/>
      {form.password && (
        <div style={{fontSize:'12px', textAlign:'left', lineHeight:'1.6'}}>
          <div style={{color: strength.length ? 'green' : 'red'}}>{strength.length ? '✅' : '❌'} 8+ chars</div>
          <div style={{color: strength.upper ? 'green' : 'red'}}>{strength.upper ? '✅' : '❌'} Uppercase</div>
          <div style={{color: strength.lower ? 'green' : 'red'}}>{strength.lower ? '✅' : '❌'} lowercase</div>
          <div style={{color: strength.number ? 'green' : 'red'}}>{strength.number ? '✅' : '❌'} Number</div>
          <div style={{color: strength.special ? 'green' : 'red'}}>{strength.special ? '✅' : '❌'} Special !@#$%</div>
        </div>
      )}
      {error && <p style={{color:'red', fontSize:13}}>{error}</p>}
      <button disabled={!isStrong} style={{opacity: isStrong ? 1 : 0.5}}>{isStrong ? 'Register ✅' : 'Weak Password ❌'}</button>
      <button type="button" onClick={googleSignup} style={{background:'white', color:'black', border:'1px solid #ccc'}}>🔵 Sign up with Google</button>
    </form>
  )
}

function Cart(){
  const { cart, remove } = useContext(CartContext); const { user } = useContext(AuthContext); const nav=useNavigate();
  const total = cart.reduce((s,i)=>s+i.price,0);

  const payWithPaystack = () => {
    if(!window.PaystackPop){ alert('Paystack script not loaded - adding...'); const s=document.createElement('script'); s.src='https://js.paystack.co/v1/inline.js'; document.body.appendChild(s); setTimeout(()=>payWithPaystack(),1500); return; }
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: user.email,
      amount: total*100, // kobo
      currency: 'NGN',
      ref: 'ESOSA_'+Date.now(),
      callback: async function(response){
        // Verify on backend
        const res = await fetch(`${API}/api/pay/verify`,{method:'POST',headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},body:JSON.stringify({reference: response.reference, items: cart, total, email: user.email})});
        const data = await res.json();
        alert('Payment Success! Order Placed ✅ Ref: '+response.reference);
        nav('/myorders');
      },
      onClose: function(){ alert('Payment cancelled'); }
    });
    handler.openIframe();
  };

  return (
    <div style={{padding:20}}>
      <h2>Cart - ₦{total} / ${total}</h2>
      {cart.map((c,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:8}}><span>{c.name} - ${c.price}</span><button onClick={()=>remove(i)}>x</button></div>)}
      {cart.length>0 ? <><button onClick={payWithPaystack} style={{marginTop:20, padding:12, background:'#0AA', color:'white', width:'100%', borderRadius:8, fontSize:16}}>💳 Pay with Paystack - ${total}</button><p style={{fontSize:12, color:'#666'}}>Test card: 4084084084084081 CVV 408 Exp 01/30</p></> : <p>Cart empty</p>}
    </div>
  )
}

function MyOrders(){
  const [orders,setOrders]=useState([]);
  useEffect(()=>{ fetch(`${API}/api/orders/my`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(setOrders) },[]);
  return <div style={{padding:20}}><h2>My Orders</h2>{orders.map(o=><div className="order" key={o._id} style={{border:'1px solid #ddd', padding:10, marginBottom:8, borderRadius:8}}>{o.total}$ - {o.status} - {o.items.length} items - Ref: {o.paystackRef}</div>)}</div>
}

function Admin(){
  const [orders,setOrders]=useState([]); const [name,setName]=useState(''); const [price,setPrice]=useState(''); const [image,setImage]=useState(''); const [category,setCategory]=useState('phones'); const [desc,setDesc]=useState(''); const [file,setFile]=useState(null); const [uploading,setUploading]=useState(false);
  useEffect(()=>{ fetch(`${API}/api/orders/all`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=>Array.isArray(d)?setOrders(d):setOrders([])) },[]);

  const handleFileUpload = async (e) => {
    const f = e.target.files[0]; if(!f) return; setFile(f); setUploading(true);
    const fd = new FormData(); fd.append('image', f);
    try{
      const res = await fetch(`${API}/api/upload`,{method:'POST',headers:{'x-auth-token':localStorage.getItem('token')},body:fd});
      const data = await res.json(); if(data.path){ setImage(`${API}${data.path}`); alert('Uploaded ✅'); } else alert(data.msg);
    }catch(err){ alert(err.message) }
    setUploading(false);
  };

  const addProduct=async(e)=>{
    e.preventDefault(); if(!image) return alert('Upload image first');
    const res = await fetch(`${API}/api/products`,{method:'POST',headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},body:JSON.stringify({name, price:Number(price), image, category, description:desc})});
    const data = await res.json(); if(data._id){ alert('Product Added ✅'); setName('');setPrice('');setImage('');setDesc('');setFile(null); } else alert(data.msg);
  };

  const totalSales = orders.reduce((s,o)=>s+o.total,0);
  return (
    <div style={{padding:20}}>
      <h2>Admin - Orders ({orders.length}) - Sales ${totalSales}</h2>
      <form onSubmit={addProduct} className="form" style={{border:'2px dashed #888', padding:15, maxWidth:450, borderRadius:12}}>
        <h3>Add Product</h3>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Product Name" required/>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{padding:8, margin:'6px 0'}}><option value="phones">phones</option><option value="laptops">laptops</option><option value="shirts">shirts</option><option value="watches">watches</option><option value="headphones">headphones</option><option value="gaming">gaming</option><option value="accessories">accessories</option></select>
        <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description - e.g. Latest iPhone with A17 chip" required/>
        <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price" type="number" required/>
        <div style={{background:'#f5f5f5', padding:10, margin:'10px 0', borderRadius:8}}><label><b>📁 Upload from Phone</b></label><input type="file" accept="image/*" onChange={handleFileUpload} style={{marginTop:5}}/>{uploading && <p>Uploading... ⏳</p>}</div>
        <input value={image} onChange={e=>setImage(e.target.value)} placeholder="https://... image URL" />
        {image && <img src={image} alt="preview" style={{width:120, height:120, objectFit:'cover', marginTop:8}}/>}
        <button type="submit" style={{marginTop:10}}>Add Product</button>
      </form>
    </div>
  )
}

export default function App(){
  const [user,setUser]=useState(()=>{ try{return JSON.parse(localStorage.getItem('user'))}catch{return null} });
  const [cart,setCart]=useState([]);
  const addToCart=(p)=>setCart([...cart,p]);
  const remove=(i)=>setCart(cart.filter((_,idx)=>idx!==i));
  const isAdmin = user?.isAdmin === true;

  useEffect(()=>{
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    document.body.appendChild(script);
  },[]);

  return (
    <AuthContext.Provider value={{user,setUser}}><CartContext.Provider value={{cart,addToCart,remove}}>
      <BrowserRouter>
        <nav className="nav" style={{display:'flex', gap:12, padding:12, background:'black', color:'white', alignItems:'center', flexWrap:'wrap'}}>
          <Link to="/" style={{color:'white', fontWeight:'bold'}}>EsosaTech</Link>
          <Link to="/" style={{color:'white'}}>Store</Link>
          <Link to="/cart" style={{color:'white'}}>Cart ({cart.length})</Link>
          {user && <Link to="/myorders" style={{color:'white'}}>My Orders</Link>}
          {isAdmin && <Link to="/admin" style={{background:'gold', color:'black', padding:'4px 8px', borderRadius:6}}>Admin 👑</Link>}
          {!user ? <><Link to="/login" style={{color:'white'}}>Login</Link><Link to="/register" style={{color:'white'}}>Register</Link></> : <><span>{user.email} {isAdmin?'👑':''}</span><button onClick={()=>{localStorage.clear();setUser(null)}}>Logout</button></>}
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
