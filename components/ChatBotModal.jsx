// components/ChatbotModal.jsx
import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

/**
 * ChatbotModal component provides an interactive AI chatbot interface.
 * It allows users to ask questions and receive answers based on data
 * processed by a Google Cloud Function (main.py).
 *
 * Props:
 * - isOpen: Boolean to control the modal's visibility.
 * - onClose: Function to call when the modal needs to be closed.
 * - userEmail: The email of the authenticated user, sent to the backend for data filtering.
 */
const ChatbotModal = ({ isOpen, onClose, userEmail }) => {
  // State to store chat messages
  const [messages, setMessages] = useState([]);
  // State for the current message being typed by the user
  const [currentMessage, setCurrentMessage] = useState('');
  // Loading state for AI responses
  const [isLoading, setIsLoading] = useState(false);
  // Ref for auto-scrolling to the latest message
  const messagesEndRef = useRef(null);

  // IMPORTANT: Replace with the actual URL of your deployed Google Cloud Function
    const CLOUD_FUNCTION_URL = "https://ai-chatbot-proxy-ngi7urpmtq-uc.a.run.app"; 
    // CORRECTED URL

  // Scroll to the bottom of the chat whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Clear messages when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setMessages([]);
      setCurrentMessage('');
    } else {
      // Add an initial greeting from the AI when the modal opens
      setMessages([{ sender: 'ai', text: "Hello! I'm your event analytics assistant. How can I help you today?" }]);
    }
  }, [isOpen]);

  // Function to send a message to the AI backend
  const sendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    const userMessage = currentMessage.trim();
    setMessages((prevMessages) => [...prevMessages, { sender: 'user', text: userMessage }]);
    setCurrentMessage(''); // Clear input field
    setIsLoading(true);

    try {
      // Replace with your deployed Google Cloud Function URL
      // Make sure this URL is correct after deploying main.py
      const cloudFunctionUrl = CLOUD_FUNCTION_URL; // <<< IMPORTANT: REPLACE THIS URL

      const response = await fetch(cloudFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: userEmail, // Send user's email for backend identification
          query: userMessage,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response from AI.');
      }

      const data = await response.json();
      setMessages((prevMessages) => [...prevMessages, { sender: 'ai', text: data.response }]);
    } catch (error) {
      console.error('Error sending message to AI:', error);
      toast.error(`Chatbot error: ${error.message}`);
      setMessages((prevMessages) => [...prevMessages, { sender: 'ai', text: "I apologize, but I encountered an error. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { // Allow Shift+Enter for new line
      e.preventDefault(); // Prevent default new line behavior
      sendMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4 sm:p-6">
      <div className="bg-deep-navy rounded-lg shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col border border-primary-gold">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-4 border-b border-dark-charcoal">
          <h2 className="text-xl font-bold text-cream-white">AI Event Assistant</h2>
          <button
            onClick={onClose}
            className="text-cream-white hover:text-primary-gold transition-colors duration-200 text-2xl"
            aria-label="Close Chatbot"
          >
            &times;
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-primary-gold text-rich-black rounded-br-none'
                    : 'bg-dark-charcoal text-cream-white rounded-bl-none'
                }`}
              >
                <p className="text-sm break-words">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-3 rounded-lg shadow-md bg-dark-charcoal text-cream-white rounded-bl-none">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-gold"></div>
                  <span className="text-sm italic">Typing...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} /> {/* Scroll target */}
        </div>

        {/* Message Input Area */}
        <div className="p-4 border-t border-dark-charcoal flex items-center space-x-3">
          <textarea
            className="flex-1 p-3 rounded-lg bg-rich-black text-cream-white border border-dark-charcoal focus:outline-none focus:border-secondary-gold resize-none"
            rows="1"
            placeholder="Ask me about past events..."
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            className="bg-primary-gold hover:bg-secondary-gold text-rich-black font-bold py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50"
            disabled={isLoading || !currentMessage.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatbotModal;
