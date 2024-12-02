import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import { v4 as uuidv4 } from 'uuid';
import Default from './components/Default.jsx';
import Welcome from './components/Welcome.jsx';
import './App.css'

import {auth, db} from '../firebase'
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc } from 'firebase/firestore';

const App = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isCopilotOpen, setIsCopilotOpen] = useState(false);
    const [tabs, setTabs] = useState([{ id: uuidv4(), url: "", name:"New Tab" }]);
    const [activeTab, setActiveTab] = useState(tabs[0].id);
    const [canGoBack, setCanGoBack] = useState(false);
    const [canGoForward, setCanGoForward] = useState(false);
    const [canReload, setCanReload] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    const [userName, setUserName] = useState("");

    

    const webviewRefs = useRef({});
   

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setIsAuthenticated(!!user);
      });
  
      return () => unsubscribe();
    }, []);
  

    //Add the url and timestamp to the database
    const saveHistory = async(url)=>{
        try{
            if(!auth.currentUser) {
                console.error("user is not authenticated")
                return;
            }

            const userId = auth.currentUser.uid;
            console.log(userId);
            const historyRef = collection(db, `users/${userId}/history`);

            await addDoc(historyRef, {
                url,
                visitedAt: new Date().toISOString(),
            });
        }catch(err){
            console.error(err.message);
        }
    }

    //Fetch Search Results from the Google URL
    const fetchSearchResults = (query) => {
        let url;
        if (query.startsWith('http')){
            url = query
        }else{
            url =`https://www.google.com/search?q=${query}`;
        }
        const faviconUrl = getFaviconUrl(url);
        updateTabUrl(activeTab, url, query, faviconUrl);
    };

    const getFaviconUrl = (url)=>{
        try{
            const urlObj = new URL(url);
            return `${urlObj.origin}/favicon.ico`
        }catch(error){
            console.error("Invalid URL:", url);
            return '';
        }
    }

    const openNewTab = () => {
        const newTab = { id: uuidv4(), url: "", name:"New Tab" };
        setTabs([...tabs, newTab]);
        setActiveTab(newTab.id);
    };

    const closeTab = (tabId) => {
        const updatedTabs = tabs.filter((tab) => tab.id !== tabId);
        setTabs(updatedTabs);

        if (activeTab === tabId && updatedTabs.length > 0) {
            setActiveTab(updatedTabs[0].id);
        }

        // Remove the webview reference when closing the tab
        delete webviewRefs.current[tabId];
    };

    const updateTabUrl = (tabId, url, query, favicon) => {
        setTabs((prevTabs) =>
            prevTabs.map((tab) =>
                tab.id === tabId ? { ...tab, url: url, name: query, favicon } : tab
            )
        );
        saveHistory(url);
    };

    const reloadCurrentTab = () => {
        const webview = webviewRefs.current[activeTab];
        if (webview) {
            webview.reload();
        } else {
            console.error("Webview not found for reload.");
        }
    };

    const goBackCurrentTab = () => {
        const webview = webviewRefs.current[activeTab];
        if (webview && webview.canGoBack()) {
            webview.goBack();
        } else {
            console.error("Webview not found or cannot go back.");
        }
    };

    const goForwardCurrentTab = () => {
        const webview = webviewRefs.current[activeTab];
        if (webview && webview.canGoForward()) {
            webview.goForward();
        } else {
            console.error("Webview not found or cannot go forward.");
        }
    };

    // Ensure the webview is updated after rendering
    useEffect(() => {
        const activeWebview = webviewRefs.current[activeTab];
        if (activeWebview) {
            activeWebview.src = tabs.find((tab) => tab.id === activeTab)?.url;
            activeWebview.addEventListener('dom-ready', () => {
                activeWebview.setZoomFactor(0.9); // Adjust this value as needed
            });

            //Check if the active webview reference can go forward, backward, or reload
            const updateNavigationButtons = () => {
                setCanGoBack(activeWebview.canGoBack());
                setCanGoForward(activeWebview.canGoForward());
                setCanReload(true);
            };
    
            activeWebview.addEventListener('did-navigate', updateNavigationButtons);
            activeWebview.addEventListener('did-navigate-in-page', updateNavigationButtons);
            activeWebview.addEventListener('dom-ready', updateNavigationButtons);
    
            return () => {
                activeWebview.removeEventListener('did-navigate', updateNavigationButtons);
                activeWebview.removeEventListener('did-navigate-in-page', updateNavigationButtons);
                activeWebview.removeEventListener('dom-ready', updateNavigationButtons);
            };
        }
    }, [activeTab, tabs]);

    
    if (!isAuthenticated) {
      return <Welcome setIsAuthenticated={setIsAuthenticated} setUserName={setUserName} />;
    }

    return (
        <div className='w-screen h-screen gradient-bg flex relative'>
            <Sidebar
                isSidebarOpen={isSidebarOpen}
                setIsSidebarOpen={setIsSidebarOpen}
                isCopilotOpen={isCopilotOpen}
                setIsCopilotOpen={setIsCopilotOpen}
                fetchSearchResults={fetchSearchResults}
                openNewTab={openNewTab}
                closeTab={closeTab}
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                reloadCurrentTab={reloadCurrentTab}
                goBackCurrentTab={goBackCurrentTab}
                goForwardCurrentTab={goForwardCurrentTab}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                canReload={canReload}
                getFaviconUrl={getFaviconUrl}
            />

            {/*TODO: Make a component for the main page and copilot page */}

            <div className={`${isSidebarOpen ? 'w-3/4' : 'w-full'} main-box-shadow flex items-center justify-center rounded-3xl my-6 mx-4 transition-all duration-150 ease-in-out`}>
                <div className={`${isCopilotOpen ? 'w-3/4 rounded-l-lg' : 'w-full rounded-lg'} h-full flex justify-center items-center overflow-hidden`}>
                    {tabs.map((tab) => (
                        <div key={tab.id} className="w-full h-full" style={{ display: activeTab === tab.id ? "block" : "none" }}>
                            {tab.url ? 
                            <webview
                                src={tab.url}
                                className="w-full h-full"
                                ref={(ref) => {
                                    if (ref) {
                                        webviewRefs.current[tab.id] = ref;
        
                                    }
                                }
                            }
                            partition="persist:default"
                            /> : 
                            <Default userName={userName}/>}
                        </div>
                    ))}
                </div>

                <div className={`${isCopilotOpen ? 'w-1/4' : 'w-0'} h-full rounded-r-lg flex justify-center items-center overflow-hidden`}>
                    {isCopilotOpen && (
                        <div className='w-full h-full'>
                            <webview 
                            src='https://outhad-search.vercel.app/'
                            className='w-full h-full'/>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default App;
