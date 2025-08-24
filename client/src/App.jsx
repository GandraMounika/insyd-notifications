import React, { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";

const DEMO_USERS = ["alice","bob","carol","dave"];

function PostCard({ post, currentUser, onLike }) {
  return (
    <div className="post">
      <div className="meta">Author: <b>{post.userId}</b> • {new Date(post.createdAt).toLocaleString()}</div>
      <div style={{marginTop:6}}>{post.content}</div>
      <div className="actions">
        <button className="btn" onClick={() => onLike(post._id)} disabled={post.userId===currentUser && true}>
          👍 Like
        </button>
      </div>
    </div>
  );
}

function NotificationItem({ n, onRead }) {
  return (
    <div className={"post " + (n.status==="unread" ? "notif-unread": "")}>
      <div style={{fontWeight:600}}>{n.title}</div>
      {n.body ? <div style={{fontSize:14, opacity:.8}}>{n.body}</div> : null}
      <div className="meta">{new Date(n.createdAt).toLocaleString()}</div>
      {n.status==="unread" && <button className="btn" style={{marginTop:8}} onClick={() => onRead(n._id)}>Mark as read</button>}
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState("alice");
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState("");
  const [notifs, setNotifs] = useState([]);
  const [pollMs, setPollMs] = useState(10000);

  const loadPosts = async () => setPosts(await api.listPosts());
  const loadNotifs = async () => setNotifs(await api.listNotifications(currentUser));

  useEffect(() => { loadPosts(); }, []);
  useEffect(() => { loadNotifs(); }, [currentUser]);

  useEffect(() => {
    const t = setInterval(() => { loadNotifs(); }, pollMs);
    return () => clearInterval(t);
  }, [currentUser, pollMs]);

  const unread = useMemo(() => notifs.filter(n=>n.status==="unread").length, [notifs]);

  const addPost = async () => {
    if (!content.trim()) return;
    await api.createPost({ userId: currentUser, content });
    setContent("");
    await loadPosts();
  };

  const likePost = async (id) => {
    await api.likePost(id, currentUser);
    await loadNotifs();
  };

  const markRead = async (id) => {
    await api.markRead(id);
    setNotifs(ns => ns.map(n => n._id===id ? { ...n, status:"read" } : n));
  };

  const markAll = async () => {
    await api.markAll(currentUser);
    setNotifs(ns => ns.map(n => ({ ...n, status:"read" })));
  };

  return (
    <div className="container">
      <div style={{flex:1}}>
        <div className="card">
          <div style={{display:"flex", alignItems:"center", gap:12}}>
            <div>
              <div style={{fontWeight:700, fontSize:18}}>Insyd Notification POC</div>
              <div style={{fontSize:12, opacity:.7}}>API: <code>{import.meta.env.VITE_API_URL}</code></div>
            </div>
            <div style={{marginLeft:"auto"}}>
              <label style={{fontSize:14, marginRight:8}}>Current user:</label>
              <select className="btn" value={currentUser} onChange={e=>setCurrentUser(e.target.value)}>
                {DEMO_USERS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{marginTop:16}}>
          <div style={{fontWeight:600, marginBottom:8}}>Create a Post</div>
          <textarea className="input" rows="3" placeholder="Share something with your followers..." value={content} onChange={e=>setContent(e.target.value)}></textarea>
          <div style={{display:"flex", gap:8, marginTop:8}}>
            <button className="btn" onClick={addPost}>Publish</button>
          </div>
        </div>

        <div className="card" style={{marginTop:16}}>
          <div style={{fontWeight:600, marginBottom:8}}>Feed</div>
          {posts.length===0 ? <div>No posts yet.</div> : posts.map(p => (
            <PostCard key={p._id} post={p} currentUser={currentUser} onLike={likePost} />
          ))}
        </div>
      </div>

      <div className="sidebar">
        <div className="card">
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{fontWeight:700}}>Notifications</div>
            <button className="btn" onClick={markAll} disabled={!unread}>Mark all read ({unread})</button>
            <label style={{marginLeft:"auto", fontSize:12}}>Poll(ms):
              <input className="input" style={{width:90, marginLeft:6}} type="number" min="3000" step="1000" value={pollMs} onChange={e=>setPollMs(parseInt(e.target.value||0,10))} />
            </label>
          </div>
          <div style={{marginTop:12}}>
            {notifs.length===0 ? <div>No notifications.</div> : notifs.map(n => (
              <NotificationItem key={n._id} n={n} onRead={markRead} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}