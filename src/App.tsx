import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAppStore } from './store';
import Home from './pages/Home';
import Editor from './pages/Editor';
import AddLimit from './pages/AddLimit';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/editor/:id" element={<Editor />} />
        <Route path="/add-limit" element={<AddLimit />} />
      </Routes>
    </BrowserRouter>
  );
}
