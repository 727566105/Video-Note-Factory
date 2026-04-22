import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@ant-design/v5-patch-for-react-19'
import './index.css'
import App from './App.tsx'
import RootLayout from './layouts/RootLayout.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootLayout>
      <App />
    </RootLayout>
  </StrictMode>
)
