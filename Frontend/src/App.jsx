import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import WidgetsPanel from './components/WidgetsPanel'

export default function App() {
  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <ChatArea />
      </div>
      <WidgetsPanel />
    </div>
  )
}