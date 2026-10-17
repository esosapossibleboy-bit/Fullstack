import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import './App.css';

const API = 'https://esosa-fullstack.onrender.com';
const PAYSTACK_PUBLIC_KEY = 'pk_test_edc0318e6275da717dc8725207d8b986a9ba7856';

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

// === STORE - NO DELETE BUTTON ===
function Store(){
  const [products,setProducts] = useState([]);
  const [search,setSearch] = useState('');
  const [category,setCategory] = useState('All');
  const { addToCart } = useContext(CartContext);

  const fetchProducts = async () => {
    const q = `?search=${search}&category=${category}`;
    const res = await fetch(`${API}/api/products${q}`);
    const data = await res.json();
    const unique = [...new Map(data.map(p => [p.name, p])).values()];
    setProducts(unique);
  };

  useEffect(()=>{ fetchProducts(); },[search, category]);

  const categories = ['All','phones','laptops','shirts','watches','headphones','gaming','accessories'];

  return (
    <div style={{padding:20}}>
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
    const googleEmail = prompt('Enter Google Email:');
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
    if(!isStrong){ setError('Weak password'); return; }
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
     