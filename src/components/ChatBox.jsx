import { useState, useEffect } from 'react';
import axios from 'axios';

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const API_KEY = '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';

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retryMessage, setRetryMessage] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '' || isLoading || !isOnline) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      sender: 'user'
    };

    setMessages([...messages, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setRetryCount(0);

    const sendRequest = async (retryAttempt = 0) => {
      try {
        if (!navigator.onLine) {
          throw new Error('Network Error');
        }

        const response = await axios.post(
          NVIDIA_API_URL,
          {
            model: 'deepseek-ai/deepseek-r1',
            messages: [
              { role: 'user', content: inputMessage }
            ]
          },
          {
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000,
            retries: 3,
            retryDelay: (retryCount) => Math.min(1000 * Math.pow(2, retryCount), 10000)
          }
        );

        const aiMessage = {
          id: Date.now() + 1,
          text: response.data.choices[0].message.content,
          sender: 'ai'
        };
        setMessages(prevMessages => [...prevMessages, aiMessage]);
        setError(null);
        setRetryMessage(null);
        return true;
      } catch (error) {
        console.error('Network Error detected:', error);
        const isNetworkError = error.message === 'Network Error' || !navigator.onLine;
        const isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
        
        if ((isNetworkError || isTimeout) && retryAttempt < 3) {
          const retryDelay = Math.min(2000 * Math.pow(2, retryAttempt), 10000);
          console.log(`Retrying attempt ${retryAttempt + 1} after ${retryDelay}ms due to network error or timeout.`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return sendRequest(retryAttempt + 1);
        }
        
        let errorText = isNetworkError ? '网络连接错误' : 
                       isTimeout ? '请求超时' : 
                       error.response?.data?.error || error.message || '未知错误';
        
        if (retryAttempt > 0) {
          errorText += `（已重试${retryAttempt}次）`;
        }
        
        setError(errorText);
        setRetryMessage(inputMessage);
        const errorMessage = {
          id: Date.now() + 1,
          text: `抱歉，发生了错误：${errorText}${!isOnline ? '（网络连接已断开）' : ''}`,
          sender: 'ai'
        };
        setMessages(prevMessages => [...prevMessages, errorMessage]);
        return false;
      }
    };

    try {
      await sendRequest();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {messages.map(message => (
          <div
            key={message.id}
            className={`message ${message.sender === 'user' ? 'user-message' : 'ai-message'}`}
          >
            {message.text}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <div className="network-status" style={{ color: isOnline ? 'green' : 'red' }}>
          {isOnline ? '网络已连接' : '网络已断开'}
        </div>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder={isOnline ? '输入消息...' : '等待网络连接...'}
          disabled={isLoading || !isOnline}
        />
        {error && retryMessage && (
          <button 
            onClick={() => {
              setInputMessage(retryMessage);
              setError(null);
              setRetryMessage(null);
              handleSendMessage();
            }}
            className="retry-button"
          >
            重试
          </button>
        )}
        <button onClick={handleSendMessage} disabled={isLoading}>
          {isLoading ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
};

export default ChatBox;