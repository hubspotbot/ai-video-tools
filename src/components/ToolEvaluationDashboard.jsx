import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Eye, Search, Filter, Plus, Calendar, TrendingUp, CheckCircle, Clock, XCircle, AlertCircle, MessageCircle, Send, Bot, User, ChevronDown } from 'lucide-react';
import evaluationsData from '../data/evaluations.json';

// Function to extract all URLs from complex example output strings
const extractUrlsFromString = (exampleOutput) => {
  if (!exampleOutput) return [];
  
  if (Array.isArray(exampleOutput)) return exampleOutput.map((url, index) => ({ url, description: `Example ${index + 1}` }));
  
  if (typeof exampleOutput === 'string') {
    // Handle special cases
    if (exampleOutput === "See BlurMantis app" || exampleOutput === "N/A") {
      return [{ url: null, description: exampleOutput }];
    }
    
    // Extract all URLs using regex
    const urlRegex = /https?:\/\/[^\s;,]+/g;
    const urls = exampleOutput.match(urlRegex) || [];
    
    if (urls.length === 0) {
      return [{ url: null, description: exampleOutput }];
    }
    
    // Try to match URLs with their descriptions
    const results = [];
    const parts = exampleOutput.split(/(?=https?:\/\/)|;|,/);
    
    urls.forEach((url, index) => {
      // Find the part that contains this URL
      const part = parts.find(p => p.includes(url));
      let description = `Example ${index + 1}`;
      
      if (part) {
        // Extract description before the URL
        const beforeUrl = part.split(url)[0];
        if (beforeUrl && beforeUrl.trim()) {
          // Clean up the description
          let desc = beforeUrl.replace(/^\d{4}-\d{2}-\d{2}:\s*/, '').trim();
          desc = desc.replace(/^[:\-\s]+/, '').trim();
          if (desc.length > 0 && desc.length < 100) {
            description = desc;
          }
        }
      }
      
      results.push({ url, description });
    });
    
    return results;
  }
  
  return [];
};

// Simple markdown renderer for chat messages
const MarkdownText = ({ children }) => {
  const renderMarkdown = (text) => {
    // Handle headers
    text = text.replace(/^### (.*$)/gim, '<h3 class="font-semibold text-gray-900 mt-3 mb-2">$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2 class="font-semibold text-gray-900 text-lg mt-4 mb-2">$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1 class="font-bold text-gray-900 text-xl mt-4 mb-3">$1</h1>');
    
    // Handle bold text **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Handle italic text *text*
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Handle inline code `code`
    text = text.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">$1</code>');
    
    // Handle line breaks
    text = text.replace(/\n/g, '<br />');
    
    // Handle bullet points (convert dashes to bullets for better readability)
    text = text.replace(/^[-*] (.+)$/gm, '<div class="ml-4">• $1</div>');
    text = text.replace(/^(\s*)[-*] (.+)$/gm, '$1<div class="ml-4">• $2</div>');
    
    return text;
  };

  return (
    <div 
      className="whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }}
    />
  );
};

const ChatInterface = React.memo(({ 
  showChat, 
  setShowChat, 
  chatMessages, 
  setChatMessages, 
  inputMessage, 
  setInputMessage, 
  isLoading, 
  setIsLoading,
  evaluations,
  messagesEndRef 
}) => {
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = { role: 'user', content: inputMessage.trim() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Create context about the tool evaluations
      const evaluationContext = evaluations.map(evaluation => ({
        toolName: evaluation.toolName,
        category: evaluation.category,
        status: evaluation.status,
        evaluator: evaluation.evaluator,
        overallScore: evaluation.overallScore,
        cost: evaluation.cost,
        keyFindings: evaluation.keyFindings,
        recommendation: evaluation.recommendation,
        pros: evaluation.pros,
        cons: evaluation.cons,
        useCases: evaluation.useCases,
        businessImpact: evaluation.businessImpact,
        exampleOutput: evaluation.exampleOutput
      }));

      const systemPrompt = `You are an AI assistant helping users understand software tool evaluations. 

Here are the current tool evaluations in our system:
${JSON.stringify(evaluationContext, null, 2)}

Please answer questions about these tool evaluations, providing insights, comparisons, recommendations, and analysis. You can:
- Summarize findings for specific tools
- Compare tools across categories
- Explain scoring rationale  
- Provide recommendations based on use cases
- Analyze business impact and costs
- Help users understand evaluation criteria

Be helpful, concise, and reference specific data from the evaluations when relevant. Use bullet points for lists instead of dashes for better readability.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemPrompt,
          messages: newMessages
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      const assistantResponse = data.content[0].text;

      setChatMessages([...newMessages, { role: 'assistant', content: assistantResponse }]);
    } catch (error) {
      console.error("Error calling Claude API:", error);
      setChatMessages([...newMessages, { 
        role: 'assistant', 
        content: "Sorry, I encountered an error while processing your request. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, chatMessages, evaluations, setChatMessages, setInputMessage, setIsLoading]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  return (
    <div className={`fixed right-4 bottom-4 w-80 sm:w-96 bg-white rounded-lg shadow-2xl border transition-all duration-300 ${showChat ? 'h-96' : 'h-14'} z-40`}>
      {/* Chat Header */}
      <div 
        className="flex items-center justify-between p-4 border-b cursor-pointer bg-blue-50 rounded-t-lg"
        onClick={() => setShowChat(!showChat)}
      >
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <span className="font-medium text-gray-900">Ask Claude about evaluations</span>
        </div>
        <MessageCircle className={`w-5 h-5 text-blue-600 transition-transform ${showChat ? 'rotate-180' : ''}`} />
      </div>

      {/* Chat Content */}
      {showChat && (
        <>
          <div className="flex-1 overflow-y-auto p-4 h-72 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center text-gray-500 text-sm mt-8">
                <Bot className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>Ask me anything about the tool evaluations!</p>
                <p className="text-xs mt-1">Try: "What are the pros and cons of Clueso?"</p>
              </div>
            )}
            
            {chatMessages.map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white rounded-br-sm' 
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                }`}>
                  <div className="flex items-start space-x-2">
                    {message.role === 'assistant' && <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                    <MarkdownText>{message.content}</MarkdownText>
                    {message.role === 'user' && <User className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 p-3 rounded-lg rounded-bl-sm text-sm">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-4 h-4" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about tool evaluations..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

const ToolEvaluationDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTool, setSelectedTool] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const messagesEndRef = useRef(null);

  // Load evaluation data from JSON file
  const [evaluations] = useState(evaluationsData);

  const availableCategories = ['AI Video Generation', 'AI Video Editing', 'AI Avatars', 'AI Image Generation', 'AI Audio Generation', 'AI Development Tools', 'AI Productivity'];
  const statuses = ['All', 'In Progress', 'Piloting', 'Approved', 'Rejected', 'Not Started'];

  const filteredEvaluations = useMemo(() => {
    return evaluations.filter(evaluation => {
      const matchesSearch = evaluation.toolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           evaluation.keyFindings.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           evaluation.evaluator.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategories.length === 0 || 
                             selectedCategories.some(selectedCat => evaluation.category.includes(selectedCat));
      
      const matchesStatus = statusFilter === '' || statusFilter === 'All' || evaluation.status === statusFilter;
      
      return matchesSearch && matchesCategory && matchesStatus;
    }).sort((a, b) => {
      // Sort by evaluation date in descending order (most recent first)
      return new Date(b.evaluationDate) - new Date(a.evaluationDate);
    });
  }, [evaluations, searchTerm, selectedCategories, statusFilter]);

  const stats = useMemo(() => {
    const total = evaluations.length;
    const approved = evaluations.filter(e => e.status === 'Approved').length;
    const piloting = evaluations.filter(e => e.status === 'Piloting').length;
    const underReview = evaluations.filter(e => e.status === 'Under Review').length;
    const rejected = evaluations.filter(e => e.status === 'Rejected').length;
    const inProgress = evaluations.filter(e => e.status === 'In Progress').length;
    const approvalRate = total > 0 ? ((approved + piloting) / total * 100) : 0;

    return {
      total,
      approved,
      piloting,
      underReview,
      rejected,
      inProgress,
      approvalRate: approvalRate.toFixed(1)
    };
  }, [evaluations]);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Approved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'Piloting': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'In Progress': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'Rejected': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'Not Started': return <AlertCircle className="w-4 h-4 text-gray-400" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'Piloting': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'Not Started': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getScoreColor = (score) => {
    if (score >= 4) return 'bg-green-500';
    if (score >= 3) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getCategoryColor = (category) => {
    const colors = {
      'AI Video Generation': 'bg-purple-100 text-purple-800 border-purple-200',
      'AI Video Editing': 'bg-blue-100 text-blue-800 border-blue-200',
      'AI Avatars': 'bg-green-100 text-green-800 border-green-200',
      'AI Image Generation': 'bg-orange-100 text-orange-800 border-orange-200',
      'AI Audio Generation': 'bg-pink-100 text-pink-800 border-pink-200',
      'AI Development Tools': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'AI Productivity': 'bg-yellow-100 text-yellow-800 border-yellow-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const toggleCategory = (category) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const DetailModal = ({ tool, onClose }) => {
    if (!tool) return null;

    const renderExampleOutputs = () => {
      const examples = extractUrlsFromString(tool.exampleOutput);
      
      if (examples.length === 0) return null;
      
      return (
        <div className="space-y-2">
          {examples.map((example, index) => {
            if (!example.url) {
              return (
                <div key={index} className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {example.description}
                </div>
              );
            }
            
            return (
              <a 
                key={index}
                href={example.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors mr-2 mb-2"
                title={example.description}
              >
                <span>
                  {example.description.length > 30 
                    ? `${example.description.substring(0, 30)}...` 
                    : example.description}
                </span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            );
          })}
        </div>
      );
    };

    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto"
        onClick={onClose}
      >
        <div 
          className="bg-white rounded-lg w-full max-w-4xl my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Fixed Header */}
          <div className="flex justify-between items-start p-4 sm:p-6 border-b border-gray-200 bg-white rounded-t-lg">
            <div className="min-w-0 flex-1 pr-4">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 break-words">
                {tool.toolName}
              </h2>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(tool.status)}`}>
                  {getStatusIcon(tool.status)}
                  <span className="ml-1">{tool.status}</span>
                </span>
                {tool.overallScore && (
                  <span className="text-xs sm:text-sm text-gray-500">Score: {tool.overallScore}/5.0</span>
                )}
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Evaluation Details</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Categories:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tool.category.map((cat, index) => (
                          <span 
                            key={index}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(cat)}`}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div><span className="font-medium">Evaluator:</span> {tool.evaluator}</div>
                    <div><span className="font-medium">Evaluation Date:</span> {tool.evaluationDate}</div>
                    {tool.nextReviewDate && (
                      <div><span className="font-medium">Next Review:</span> {tool.nextReviewDate}</div>
                    )}
                    <div><span className="font-medium">Cost:</span> {tool.cost}</div>
                  </div>
                </div>

                {/* Only show score breakdown if detailedScores exist */}
                {tool.detailedScores && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Score Breakdown</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                      {Object.entries(tool.detailedScores).map(([criterion, score]) => (
                        <div key={criterion} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 flex-1 min-w-0" title={criterion}>
                            {criterion.length > 20 ? `${criterion.substring(0, 20)}...` : criterion}
                          </span>
                          <div className="w-12 bg-gray-200 rounded-full h-2 flex-shrink-0">
                            <div
                              className={`h-2 rounded-full ${getScoreColor(score)}`}
                              style={{ width: `${(score / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-6 text-right flex-shrink-0">{score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Key Findings</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{tool.keyFindings}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Pros</h3>
                  <ul className="space-y-2">
                    {tool.pros.map((pro, index) => (
                      <li key={index} className="text-sm text-green-700 flex items-start">
                        <CheckCircle className="w-3 h-3 mt-0.5 mr-2 flex-shrink-0" />
                        <span>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Cons</h3>
                  <ul className="space-y-2">
                    {tool.cons.map((con, index) => (
                      <li key={index} className="text-sm text-red-700 flex items-start">
                        <XCircle className="w-3 h-3 mt-0.5 mr-2 flex-shrink-0" />
                        <span>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Recommendation</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{tool.recommendation}</p>
              </div>

              {/* Only show use cases if they exist */}
              {tool.useCases && tool.useCases.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Optimal Use Cases</h3>
                  <ul className="space-y-1">
                    {tool.useCases.map((useCase, index) => (
                      <li key={index} className="text-sm text-gray-700">• {useCase}</li>
                    ))}
                  </ul>
                </div>
              )}

              {tool.exampleOutput && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Example Outputs</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700 mb-3">
                      See live examples of content created with {tool.toolName}:
                    </p>
                    {renderExampleOutputs()}
                  </div>
                </div>
              )}

              <div className="pb-4">
                <h3 className="font-semibold text-gray-900 mb-3">Business Impact</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{tool.businessImpact}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tool Evaluation Dashboard</h1>
          <p className="text-gray-600">Track and monitor software tool evaluations for the team</p>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Total Tools</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">Approval Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approvalRate}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-500">In Progress</p>
                <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Tools</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by tool name, findings, or evaluator..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
              <div className="relative">
                <button
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-left flex items-center justify-between"
                >
                  <span className="text-sm text-gray-700">
                    {selectedCategories.length === 0 
                      ? 'Select categories...' 
                      : `${selectedCategories.length} selected`}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {categoryDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    <div className="p-2">
                      {availableCategories.map(category => (
                        <label key={category} className="flex items-center p-2 hover:bg-gray-50 cursor-pointer rounded">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(category)}
                            onChange={() => toggleCategory(category)}
                            className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{category}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {statuses.map(status => (
                  <option key={status} value={status === 'All' ? '' : status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selected Categories Display */}
          {selectedCategories.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-2">
                {selectedCategories.map(category => (
                  <span 
                    key={category}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getCategoryColor(category)}`}
                  >
                    {category}
                    <button
                      onClick={() => toggleCategory(category)}
                      className="ml-1 hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <button
                  onClick={() => setSelectedCategories([])}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Evaluations Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Tool Evaluations</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tool</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categories</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key Findings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEvaluations.map((evaluation) => (
                  <tr key={evaluation.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{evaluation.toolName}</div>
                      <div className="text-sm text-gray-500">{evaluation.evaluationDate}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {evaluation.category.map((cat, index) => (
                          <span 
                            key={index}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getCategoryColor(cat)}`}
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(evaluation.status)}`}>
                        {getStatusIcon(evaluation.status)}
                        <span className="ml-1">{evaluation.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs">
                        <span title={evaluation.keyFindings}>
                          {evaluation.keyFindings.length > 80 
                            ? `${evaluation.keyFindings.substring(0, 80)}...` 
                            : evaluation.keyFindings}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedTool(evaluation)}
                        className="text-blue-600 hover:text-blue-900"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredEvaluations.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-500">No tools match your current filters.</div>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                <span className="font-medium">FLORA</span> comprehensive evaluation completed by Oscar Estrada
              </span>
              <span className="text-xs text-gray-400">Aug 29, 2025</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                <span className="font-medium">Clueso</span> evaluation completed by Oscar Estrada
              </span>
              <span className="text-xs text-gray-400">Aug 15, 2025</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">
                <span className="font-medium">Capsule AI Productions</span> evaluation completed by Oscar Estrada
              </span>
              <span className="text-xs text-gray-400">Aug 30, 2025</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat Interface */}
      <ChatInterface 
        showChat={showChat}
        setShowChat={setShowChat}
        chatMessages={chatMessages}
        setChatMessages={setChatMessages}
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        isLoading={isLoading}
        setIsLoading={setIsLoading}
        evaluations={evaluations}
        messagesEndRef={messagesEndRef}
      />

      {/* Detail Modal */}
      {selectedTool && (
        <DetailModal tool={selectedTool} onClose={() => setSelectedTool(null)} />
      )}
    </div>
  );
};

export default ToolEvaluationDashboard;
