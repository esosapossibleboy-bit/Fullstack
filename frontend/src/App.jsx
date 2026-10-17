import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './App.css';

const API = 'https://esosa-fullstack.onrender.com'; // or http://localhost:5000

// === CONTEXTS ===
const AuthContext = createContext();
const CartContext = createContext();

// === PROTECTED ROUTE ===
function ProtectedRoute({ children, adminOnly }){
  const { user } = useContext(AuthContext);
  if(!user) return <Navigate to="/login" />;
  if(adminOnly && user.isAdmin !== true) return <h2 style={{padding:30}}>❌ Access Denied - isAdmin = false</h2>;
  return children;
}

// === STRONG PASSWORD VALIDATOR ===
function checkPasswordStrength(pwd){
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /[0-9]/.test(pwd),
    special: /[!@#$%^&*]/.test(pwd),
  };
}

// === PAGES ===
function Store(){
  const [products,setProducts] = useState([]);
  const { addToCart } = useContext(CartContext);
  useEffect(()=>{ fetch(`${API}/api/products`).then(r=>r.json()).then(setProducts) },[]);
  return (
    <div className="grid">
      {products.map(p=>(
        <div key={p._id} className="card">
          <img src={p.image} crossOrigin="anonymous" />
          <h3>{p.name}</h3><p>${p.price}</p>
          <button onClick={()=>addToCart(p)}>Add to Cart</button>
        </div>
      ))}
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
  return <form onSubmit={submit} className="form"><h2>Login</h2><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email"/><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="password"/><button>Login</button></form>
}

function Register(){
  const [email,setEmail]=useState(''); const [pass,setPass]=useState(''); const nav=useNavigate();
  const [error,setError]=useState('');
  const strength = checkPasswordStrength(pass);
  const isStrong = Object.values(strength).every(v=>v===true);
  const submit=async(e)=>{
    e.preventDefault();
    if(!isStrong){ setError('Password must be 8+ chars, with Uppercase, lowercase, number & special char'); return; }
    const res=await fetch(`${API}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
    const data=await res.json();
    if(data.token){ alert('Registered! isAdmin='+data.user.isAdmin); nav('/login'); } 
    else { setError(data.msg); alert(data.msg); }
  };
  return (
    <form onSubmit={submit} className="form">
      <h2>Register</h2>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email"/>
      <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="password"/>
      {pass && (
        <div style={{fontSize:'12px', textAlign:'left', margin:'8px 0', lineHeight:'1.6'}}>
          <div style={{color: strength.length ? 'green' : 'red'}}>{strength.length ? '✅' : '❌'} At least 8 characters</div>
          <div style={{color: strength.upper ? 'green' : 'red'}}>{strength.upper ? '✅' : '❌'} 1 Uppercase (A-Z)</div>
          <div style={{color: strength.lower ? 'green' : 'red'}}>{strength.lower ? '✅' : '❌'} 1 lowercase (a-z)</div>
          <div style={{color: strength.number ? 'green' : 'red'}}>{strength.number ? '✅' : '❌'} 1 number (0-9)</div>
          <div style={{color: strength.special ? 'green' : 'red'}}>{strength.special ? '✅' : '❌'} 1 special (!@#$%^&*)</div>
        </div>
      )}
      {error && <p style={{color:'red', fontSize:'13px'}}>{error}</p>}
      <button disabled={!isStrong && pass.length>0} style={{opacity: isStrong || pass.length===0 ? 1 : 0.5}}>
        {isStrong ? 'Register ✅' : 'Weak Password ❌'}
      </button>
    </form>
  )
}

function Cart(){
  const { cart, remove } = useContext(CartContext); const { user } = useContext(AuthContext); const nav=useNavigate();
  const total = cart.reduce((s,i)=>s+i.price,0);
  const checkout=async()=>{
    await fetch(`${API}/api/orders`,{method:'POST',headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},body:JSON.stringify({items:cart,total,email:user.email})});
    alert('Order Placed!'); nav('/myorders');
  };
  return <div><h2>Cart - ${total}</h2>{cart.map((c,i)=><div key={i}>{c.name} - ${c.price} <button onClick={()=>remove(i)}>x</button></div>)}<button onClick={checkout}>Checkout</button></div>
}

function MyOrders(){
  const [orders,setOrders]=useState([]);
  useEffect(()=>{ fetch(`${API}/api/orders/my`,{headers:{'x-auth-token':localStorage.getItem('token')}}).then(r=>r.json()).then(setOrders) },[]);
  return <div><h2>My Orders</h2>{orders.map(o=><div className="order" key={o._id}>{o.total}$ - {o.status} - {o.items.length} items</div>)}</div>
}

// === ADMIN WITH PHONE/LAPTOP UPLOAD + INTERNET URL ===
function Admin(){
  const [orders,setOrders]=useState([]); 
  const [name,setName]=useState(''); 
  const [price,setPrice]=useState(''); 
  const [image,setImage]=useState('');
  const [file,setFile]=useState(null);
  const [uploading,setUploading]=useState(false);

  useEffect(()=>{ 
    fetch(`${API}/api/orders/all`,{headers:{'x-auth-token':localStorage.getItem('token')}})
    .then(r=>r.json()).then(d=>Array.isArray(d)?setOrders(d):setOrders([])) 
  },[]);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if(!selectedFile) return;
    setFile(selectedFile);
    setUploading(true);
    const formData = new FormData();
    formData.append('image', selectedFile);
    try {
      const res = await fetch(`${API}/api/upload`,{
        method:'POST',
        headers:{'x-auth-token':localStorage.getItem('token')},
        body: formData
      });
      const data = await res.json();
      if(data.path){
        // Build full URL: API + /uploads/...
        const fullImageUrl = `${API}${data.path}`;
        setImage(fullImageUrl);
        alert('Image uploaded from phone/laptop! ✅');
      } else {
        alert(data.msg || 'Upload failed');
      }
    } catch(err){ alert('Upload error: ' + err.message) }
    setUploading(false);
  };

  const addProduct=async(e)=>{
    e.preventDefault();
    if(!image) return alert('Upload image from phone OR paste URL first');
    const res = await fetch(`${API}/api/products`,{method:'POST',headers:{'Content-Type':'application/json','x-auth-token':localStorage.getItem('token')},body:JSON.stringify({name,price:Number(price),image})});
    const data = await res.json();
    if(data._id){ alert('Product Added ✅'); setName('');setPrice('');setImage('');setFile(null); }
    else alert(data.msg || 'Failed');
  };

  const totalSales = orders.reduce((s,o)=>s+o.total,0);
  return (
    <div style={{padding:20}}>
      <h2>Admin Dashboard - All Orders ({orders.length}) - Sales ${totalSales}</h2>
      
      <form onSubmit={addProduct} className="form" style={{border:'2px dashed #888', padding:15, maxWidth:400}}>
        <h3>Add Product</h3>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Product Name" required/>
        <input value={price} onChange={e=>setPrice(e.target.value)} placeholder="Price" type="number" required/>
        
        <div style={{background:'#f5f5f5', padding:10, margin:'10px 0', borderRadius:8}}>
          <label><b>📁 Option 1: Upload from Phone / Laptop</b></label>
          <input type="file" accept="image/*" onChange={handleFileUpload} style={{marginTop:5}} />
          {uploading && <p>Uploading... ⏳</p>}
          {file && <p style={{fontSize:12}}>Selected: {file.name}</p>}
        </div>

        <div style={{background:'#eef', padding:10, margin:'10px 0', borderRadius:8}}>
          <label><b>🌐 Option 2: Paste Image URL from Internet</b></label>
          <input value={image} onChange={e=>setImage(e.target.value)} placeholder="https://... or auto-filled after upload" style={{marginTop:5}}/>
        </div>

        {image && (
          <div style={{margin:'10px 0'}}>
            <p>Preview:</p>
            <img src={image} alt="preview" style={{width:'120px', height:'120px', objectFit:'cover', border:'1px solid #ccc'}} />
          </div>
        )}

        <button type="submit">Add Product</button>
      </form>

      <h3 style={{marginTop:30}}>Recent Orders</h3>
      {orders.map(o=><div key={o._id} className="order">{o.userEmail} - ${o.total} - {o.status}</div>)}
    </div>
  )
}

// === MAIN APP ===
export default function App(){
  const [user,setUser]=useState(()=>{ try{return JSON.parse(localStorage.getItem('user'))}catch{return null} });
  const [cart,setCart]=useState([]);
  const addToCart=(p)=>setCart([...cart,p]);
  const remove=(i)=>setCart(cart.filter((_,idx)=>idx!==i));
  const isAdmin = user?.isAdmin === true;

  return (
    <AuthContext.Provider value={{user,setUser}}><CartContext.Provider value={{cart,addToCart,remove}}>
      <BrowserRouter>
        <nav className="nav">
          <Link to="/">EsosaTech</Link>
          <Link to="/">Store</Link>
          <Link to="/cart">Cart ({cart.length})</Link>
          {user && <Link to="/myorders">My Orders</Link>}
          {isAdmin && <Link to="/admin" className="adminBtn">Admin 👑</Link>}
          {!user ? <><Link to="/login">Login</Link><Link to="/register">Register</Link></> : <><span>{user.email} {isAdmin?'👑':''}</span><button onClick={()=>{localStorage.clear();setUser(null)}}>Logout</button></>}
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