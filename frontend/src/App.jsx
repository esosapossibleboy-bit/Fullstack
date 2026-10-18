import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import './App.css';

const API = import.meta.env.VITE_API_URL || 'https://esosa-fullstack.onrender.com';
const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_KEY;

const AuthContext = createContext();
const CartContext = createContext();

function ProtectedRoute({ children, adminOnly }){
  const { user } = useContext(AuthContext);
  if(!user) return <Navigate to="/login" replace />;
  if(adminOnly && user.isAdmin !== true) return <h2 style={{padding:30}}>❌ Admin Only</h2>;
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
        <input value={search} onChange={e=>setSearch(e.target.value.slice(0,50))} placeholder="🔍 Search" style={{padding:10, width:300, borderRadius:8, border:'1px solid #ccc'}} maxLength={50}/>
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
    if(attempts >= 5) return alert('Too many attempts');
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
    if(!googleEmail || !googleEmail.includes('@')) return;
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
      <button disabled={loading}>{loading?'Loading...':'Login'}</button>
      <div style={{textAlign:'center', color:'#888', fontSize:13}}>OR</div>
      <button type="button" onClick={googleLogin} style={{width:'100%', background:'white', color:'#444', border:'1px solid #ccc', padding:'10px', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontWeight:600, cursor:'pointer'}}>
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="google" style={{width:20, height:20}} /> Continue with Google
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
    if(!isStrong){ setError('Weak password'); return; }
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
    if(!googleEmail || !googleEmail.includes('@')) return;
    try {
      const res = await fetch(`${API}/api/auth/google`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:googleEmail.toLowerCase().trim(), firstName:'Google', lastName:'User'})});
      const data = await res.json();
      if(data.token){ localStorage.setItem('token',data.token); localStorage.setItem('user',JSON.stringify(data.user)); setUser(data.user); nav('/'); }
    } catch { alert('Google login failed'); }
  };
  return (
    <form onSubmit={submit} style={{maxWidth:420, margin:'20px auto', padding:20, border:'1px solid #ddd', borderRadius:12, display:'flex', flexDirection:'column', gap:8, background:'white'}}>
      <h2>Create Account</h2>
      <div style={{display:'flex', gap:8}}><input value={form.firstName} onChange={e=>handle('firstName',e.target.value)} placeholder="First Name" required/><input value={form.lastName} onChange={e=>handle('lastName',e.target.value)} placeholder="Last Name" required/></div>
      <div style={{display:'flex', gap:8}}>
        <select value={form.gender} onChange={e=>handle('gender',e.target.value)} style={{flex:1, padding:8}}><option>Male</option><option>Female</option><option>Other</option></select>
        <input value={form.country} onChange={e=>handle('country',e.target.value)} placeholder="Country" required style={{flex:1}}/>
      </div>
      <input value={form.phone} onChange={e=>handle('phone',e.target.value)} placeholder="Phone" required/>
      <input value={form.email} onChange={e=>handle('email',e.target.value)} placeholder="Email" required type="email"/>
      <input type="password" value={form.password} onChange={e=>handle('password',e.target.value)} placeholder="Password" required/>
      {form.password && (
        <div style={{fontSize:'12px'}}>
          <div style={{color: strength.length ? 'green' : 'red'}}>{strength.length ? '✅' : '❌'} 8+ chars</div>
          <div style={{color: strength.upper ? 'green' : 'red'}}>{strength.upper ? '✅' : '❌'} Uppercase</div>
          <div style={{color: strength.lower ? 'green' : 'red'}}>{strength.lower ? '✅' : '❌'} lowercase</div>
          <div style={{color: strength.number ? 'green' : 'red'}}>{strength.number ? '✅' : '❌'} Number</div>
          <div style={{color: strength.special ? 'green' : 'red'}}>{strength.special ? '✅' : '❌'} Special !@#$%</div>
        </div>
      )}
      {error && <p style={{color:'red', fontSize:13}}>{error}</p>}
      <button disabled={!isStrong || loading} style={{opacity: isStrong ? 1 : 0.5, background: isStrong ? 'black' : '#888', color:'white', padding:10, borderRadius:6}}>{loading?'Creating...': isStrong ? 'Register ✅' : 'Weak Password ❌'}</button>
      <div style={{textAlign:'center', color:'#888', fontSize:13, marginTop:5}}>OR</div>
      <button type="button" onClick={googleLogin} style={{width:'100%', background:'white', color:'#444', border:'1px solid #ccc', padding:'10px', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontWeight:600, cursor:'pointer'}}>
        <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="google" style={{width:20, height:20}} /> Continue with Google
      </button>
    </form>
  )
}

function Cart(){
  const { cart, remove, clearCart } = useContext(CartContext); 
  const { user } = useContext(AuthContext); 
  const nav=useNavigate();
  const total = cart.reduce((s,i)=>s+ (Number(i.price) || 0),0);
  useEffect(()=>{
    if(!document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')){
      const s=document.createElement('script'); s.src='https://js.paystack.co/v1/inline.js'; document.body.appendChild(s);
    }
  },[]);
  const payWithPaystack = () => {
    if(total <=0) return alert('Cart empty');
    if(!user?.email) return alert('Please login again');
    if(!PAYSTACK_PUBLIC_KEY) return alert('Missing VITE_PAYSTACK_KEY');
    if(!window.PaystackPop) return alert('Paystack loading... wait 2 sec');
    const handler = window.PaystackPop.setup({
      key: PAYSTACK_PUBLIC_KEY, email: user.email, amount: total * 100, currency: 'NGN', ref: 'ESOSA_'+Date.now(),
      callback: function(response){
        fetch(`${API}/api/pay/verify`,{
          method:'POST', headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},
          body:JSON.stringify({reference: response.reference, items: cart, total, email: user.email})
        }).then(r=>r.json()).then(d=>{ alert('Payment Success! ✅ Ref: '+response.reference); clearCart(); nav('/myorders'); })
        .catch(()=>{ alert('Payment done: '+response.reference); clearCart(); nav('/myorders'); });
      },
      onClose: function(){ console.log('closed'); }
    });
    handler.openIframe();
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
  const nav=useNavigate();
  useEffect(()=>{ fetch(`${API}/api/orders/my`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=> Array.isArray(d)? setOrders(d): setOrders([])).catch(()=> setOrders([])); },[]);
  return <div style={{padding:20}}><h2>My Orders</h2>{orders.map(o=><div key={o._id} onClick={()=>nav(`/order/${o._id}`)} style={{border:'1px solid #ddd', padding:12, marginBottom:8, borderRadius:8, background:'white', cursor:'pointer'}}><b>{Number(o.total)||0}$</b> - {sanitize(o.status)} - {o.items?.length || 0} items<br/><small>Ref: {sanitize(o.paystackRef)} - Click for details 👁️</small></div>)}{orders.length===0 && <p>No orders yet</p>}</div>
}

function OrderDetails(){
  const { id } = useParams();
  const [order,setOrder]=useState(null);
  useEffect(()=>{
    fetch(`${API}/api/orders/${id}`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=>setOrder(d)).catch(()=>setOrder(null));
  },[id]);
  if(!order) return <div style={{padding:20}}>Loading order...</div>;
  return (
    <div style={{padding:20, maxWidth:600, margin:'0 auto'}}>
      <h2>Order Details</h2>
      <div style={{border:'2px solid #0AA', padding:15, borderRadius:12, background:'white'}}>
        <p><b>Order ID:</b> {order._id}</p>
        <p><b>Ref:</b> {sanitize(order.paystackRef)}</p>
        <p><b>Status:</b> <span style={{background: order.status==='Paid' ? 'lightgreen' : '#eee', padding:'2px 8px', borderRadius:4}}>{order.status}</span></p>
        <p><b>Total:</b> ${order.total}</p>
        <p><b>Email:</b> {order.email || order.userEmail}</p>
        <p><b>Date:</b> {new Date(order.createdAt).toLocaleString()}</p>
        <h3>Items ({order.items?.length}):</h3>
        {order.items?.map((it,i)=><div key={i} style={{display:'flex', justifyContent:'space-between', padding:8, borderBottom:'1px solid #eee'}}><span>{sanitize(it.name)}</span><b>${it.price}</b></div>)}
      </div>
      <Link to="/myorders" style={{display:'inline-block', marginTop:15, color:'#0AA'}}>← Back to My Orders</Link>
    </div>
  )
}

// ===== FIXED BIG FORM - THIS IS THE NEW CODE =====
function Admin(){
  const [orders,setOrders]=useState([]); 
  const [products,setProducts]=useState([]);
  const [name,setName]=useState(''); const [price,setPrice]=useState(''); const [image,setImage]=useState(''); const [category,setCategory]=useState('phones'); const [desc,setDesc]=useState(''); const [uploading,setUploading]=useState(false);

  const fetchAll = ()=>{
    fetch(`${API}/api/orders/all`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(d=>Array.isArray(d)?setOrders(d):setOrders([])).catch(()=>setOrders([]));
    fetch(`${API}/api/products`).then(r=>r.json()).then(d=>Array.isArray(d)?setProducts(d):setProducts([])).catch(()=>setProducts([]));
  };
  useEffect(()=>{ fetchAll(); },[]);

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
      if(data._id){ alert('Product Added ✅'); setName('');setPrice('');setImage('');setDesc(''); fetchAll(); } else alert(data.msg || 'Failed');
    } catch { alert('Add failed'); }
  };

  const deleteProduct = async (id, productName)=>{
    if(!confirm(`Delete ${productName}?`)) return;
    try {
      const res = await fetch(`${API}/api/products/${id}`,{method:'DELETE', headers:{'x-auth-token':localStorage.getItem('token')}});
      if(res.ok){ alert('Deleted ✅'); setProducts(products.filter(p=>p._id!==id)); } else alert('Delete failed');
    } catch { alert('Delete error'); }
  };

  const deleteOrder = async (id)=>{
    if(!confirm('Delete this order?')) return;
    try {
      const res = await fetch(`${API}/api/orders/${id}`,{method:'DELETE', headers:{'x-auth-token':localStorage.getItem('token')}});
      if(res.ok){ alert('Order deleted ✅'); setOrders(orders.filter(o=>o._id!==id)); } else alert('Delete failed');
    } catch { alert('Delete error'); }
  };

  const totalSales = orders.reduce((s,o)=>s+ (Number(o.total) || 0),0);
  return (
    <div style={{padding:20}}>
      <h2 style={{textAlign:'center', marginBottom:20}}>Admin - Orders ({orders.length}) - Sales ${totalSales} - Products ({products.length})</h2>
      
      {/* BIG FORM - FITS NOW */}
      <form onSubmit={addProduct} style={{border:'2px solid #222', padding:28, maxWidth:700, margin:'0 auto 35px auto', borderRadius:18, background:'white', boxShadow:'0 6px 20px rgba(0,0,0,0.1)'}}>
        <h3 style={{textAlign:'center', marginBottom:22, fontSize:26}}>Add Product</h3>
        
        <div style={{display:'flex', gap:12, marginBottom:14, flexWrap:'wrap'}}>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Product Name" required style={{flex:2, minWidth:200, padding:14, borderRadius:10, border:'1px solid #ccc', fontSize:16}}/>
          <select value={category} onChange={e=>setCategory(e.target.value)} style={{flex:1, minWidth:130, padding:14, borderRadius:10, border:'1px solid #ccc', fontSize:15}}><option value="phones">phones</option><option value="laptops">laptops</option><option value="shirts">shirts</option><option value="watches">watches</option><option value="headphones">headphones</option><option value="gaming">gaming</option><option value="accessories">accessories</option></select>
        </div>

        <div style={{display:'flex', gap:12, marginBottom:14, flexWrap:'wrap'}}>
          <input value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Description - what is this product?" required style={{flex:2, minWidth:200, padding:14, borderRadius:10, border:'1px solid #ccc', fontSize:15}}/>
          <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price $" type="number" required style={{flex:1, minWidth:120, padding:14, borderRadius:10, border:'1px solid #ccc', fontSize:15}}/>
        </div>

        <div style={{background:'#eef6ff', padding:18, margin:'18px 0', borderRadius:12, border:'2px dashed #0AA', textAlign:'center'}}>
          <label style={{fontWeight:'bold', display:'block', marginBottom:10, fontSize:16}}>📁 Upload Product Image (Max 2MB - JPG / PNG / WEBP)</label>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileUpload} style={{fontSize:14}}/>
          {uploading && <p style={{color:'#0AA', fontWeight:'bold', marginTop:8}}>Uploading... wait</p>}
        </div>

        <input value={image} onChange={e=>setImage(e.target.value)} placeholder="Image URL will appear here after upload, or paste https:// link" style={{width:'100%', padding:14, borderRadius:10, border:'1px solid #ccc', fontSize:14, marginBottom:14, boxSizing:'border-box'}}/>
        {image && <img src={image} alt="preview" style={{width:'100%', maxHeight:220, objectFit:'contain', marginBottom:14, borderRadius:10, border:'1px solid #eee'}}/>}
        
        <button type="submit" style={{width:'100%', padding:16, background:'black', color:'white', borderRadius:12, fontSize:18, fontWeight:'bold', cursor:'pointer', border:'none'}}>➕ Add Product to Store</button>
      </form>

      <h3 style={{marginBottom:15}}>🛒 All Products - Click 🗑️ to Delete ({products.length})</h3>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12, marginBottom:30}}>
        {products.map(p=>(
          <div key={p._id} style={{border:'1px solid #ddd', padding:10, borderRadius:10, background:'white'}}>
            <img src={p.image?.startsWith('/uploads') ? `${API}${p.image}` : p.image} style={{width:'100%', height:130, objectFit:'cover', borderRadius:8}} alt=""/>
            <p style={{margin:'8px 0 4px 0', fontWeight:'bold', fontSize:14}}>{sanitize(p.name)}</p>
            <p style={{margin:0, fontSize:13}}>${p.price} - {p.category}</p>
            <button onClick={()=>deleteProduct(p._id, p.name)} style={{width:'100%', marginTop:8, background:'#FF4444', color:'white', padding:8, borderRadius:6, border:'none', cursor:'pointer', fontWeight:'bold'}}>🗑️ Delete Product</button>
          </div>
        ))}
      </div>

      <h3>📦 All Orders ({orders.length})</h3>
      <div style={{display:'grid', gap:8}}>
        {orders.map(o=>(
          <div key={o._id} style={{border:'1px solid #ddd', padding:12, borderRadius:8, background:'white', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div>
              <Link to={`/order/${o._id}`} style={{fontWeight:'bold', color:'#0AA', textDecoration:'none'}}>{o.total}$ - {o.status} - {sanitize(o.email || o.userEmail)}</Link>
              <div style={{fontSize:12, color:'#666'}}>Ref: {sanitize(o.paystackRef)} - {o.items?.length} items - {new Date(o.createdAt).toLocaleDateString()}</div>
            </div>
            <button onClick={()=>deleteOrder(o._id)} style={{background:'#FF4444', color:'white', padding:'6px 12px', borderRadius:6, border:'none', cursor:'pointer'}}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App(){
  const [user,setUser]=useState(()=>{ try{ const u=JSON.parse(localStorage.getItem('user')); return u && u.email ? u : null }catch{return null} });
  const [cart,setCart]=useState([]);
  const addToCart=(p)=>{ if(cart.length >=20) return alert('Max 20 items'); setCart([...cart,p]); };
  const remove=(i)=>setCart(cart.filter((_,idx)=>idx!==i));
  const clearCart=()=>setCart([]);
  const isAdmin = user?.isAdmin === true;
  useEffect(()=>{ const script = document.createElement('script'); script.src = 'https://js.paystack.co/v1/inline.js'; document.body.appendChild(script); },[]);
  return (
    <AuthContext.Provider value={{user,setUser}}><CartContext.Provider value={{cart,addToCart,remove,clearCart}}>
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
          <Route path="/order/:id" element={<ProtectedRoute><OrderDetails/></ProtectedRoute>}/>
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin/></ProtectedRoute>}/>
        </Routes>
      </BrowserRouter>
    </CartContext.Provider></AuthContext.Provider>
  );
}