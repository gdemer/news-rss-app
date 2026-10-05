import { useState, useEffect, useCallback } from 'react';
import './App.css';

const rssUrlList = [
  "https://www.newsbeast.gr/feed",
  "https://www.newsbeast.gr/greece/feed",
  "https://www.newsbeast.gr/world/feed",
  "https://www.newsbeast.gr/technology/feed",
  "https://www.newsbeast.gr/sports/feed",
  "https://www.newsbeast.gr/culture/feed",
  "https://www.newsbeast.gr/science/feed",
  "https://www.newsbeast.gr/health/feed",
  "https://www.newsbeast.gr/travel/feed",
  "https://www.newsbeast.gr/opinion/feed",
  "https://www.newsbeast.gr/entertainment/feed",
  "https://www.newsbomb.gr/oles-oi-eidhseis?format=feed&type=rss",
  "https://www.in.gr/rss",
  "https://devblogs.microsoft.com/rss/",
  "https://www.dwrean.net/feeds/posts/default?alt=rss",
  "https://www.tanea.gr/?feed=rss2",
  "https://www.kathimerini.gr/infeeds/rss/nx-rss-feed.xml",
  "https://tovima.gr/feed",
  "https://en.protothema.gr/feed",
  "https://www.vradini.gr/feed/",
  "https://www.naftemporiki.gr/feed/",
  "https://www.ethnos.gr/rss-news?positionid=1",
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  "https://www.theguardian.com/world/rss",
  "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
  "https://www.aljazeera.com/xml/rss/all.xml"
];

// Μετατρέπει την UTC ημερομηνία σε τοπική ώρα Ελλάδος
const formatToLocalTime = (dateString) => {
  if (!dateString) return '';
  const isoFormatted = dateString.replace(' ', 'T');
  const date = new Date(isoFormatted);
  
  return date.toLocaleString('el-GR', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State για το επιλεγμένο άρθρο & το πλήρες περιεχόμενό του
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [fullArticleHtml, setFullArticleHtml] = useState('');
  const [loadingFullText, setLoadingFullText] = useState(false);
  
  // State για το URL που προβάλλεται στο iframe Modal
  const [iframeUrl, setIframeUrl] = useState(null);

  // 🔄 Συνάρτηση φόρτωσης/ανανέωσης ειδήσεων
  const fetchAllNews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Cache-buster timestamp για παράκαμψη της προσωρινής μνήμης (cache)
      const timestamp = new Date().getTime();

      const fetchPromises = rssUrlList.map(async (rssUrl) => {
        try {
          // Προσθήκη cache-buster (&_t=...)
          const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&_t=${timestamp}`;
          const response = await fetch(apiUrl, { cache: 'no-store' });
          const data = await response.json();
          
          if (data.status === 'ok') {
            return data.items.map((item) => ({
              ...item,
              sourceTitle: data.feed?.title || 'Ειδήσεις'
            }));
          }
          return [];
        } catch (err) {
          console.warn(`Αποτυχία φόρτωσης για το feed: ${rssUrl}`, err);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      const combinedArticles = results.flat();

      // Ταξινόμηση από το νεότερο προς το παλαιότερο
      combinedArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

      setArticles(combinedArticles);
    } catch (err) {
      setError('Σφάλμα κατά τη φόρτωση των ειδήσεων.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllNews();
  }, [fetchAllNews]);

  // Καθαρισμός κειμένου περιγραφής
  const getCleanDescription = (item) => {
    const rawText = item.description || item.content || '';
    const cleanText = rawText.replace(/<[^>]*>?/gm, '').trim();

    if (cleanText.length > 0) {
      return cleanText.length > 120 ? cleanText.substring(0, 120) + '...' : cleanText;
    }
    return 'Δεν υπάρχει διαθέσιμη περίληψη. Πατήστε για να διαβάσετε την είδηση.';
  };

  const handleOpenArticle = async (item) => {
    setSelectedArticle(item);
    setLoadingFullText(true);
    setFullArticleHtml('');

    const defaultText = item.content || item.description || 'Δεν διατίθεται επιπλέον κείμενο για αυτό το άρθρο.';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(item.link)}`;
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await res.json();

      if (data && data.contents) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.contents, 'text/html');

        const selectorsToRemove = ['script', 'style', 'nav', 'footer', 'header', 'iframe', 'aside', 'form', '.ads'];
        selectorsToRemove.forEach((s) => doc.querySelectorAll(s).forEach((el) => el.remove()));

        const mainContent = doc.querySelector('article') || doc.querySelector('main') || doc.body;
        const paragraphs = Array.from(mainContent.querySelectorAll('p'))
          .map((p) => p.outerHTML)
          .filter((html) => html.replace(/<[^>]*>?/gm, '').trim().length > 20)
          .join('');

        if (paragraphs && paragraphs.trim().length > 50) {
          setFullArticleHtml(paragraphs);
        } else {
          setFullArticleHtml(defaultText);
        }
      } else {
        setFullArticleHtml(defaultText);
      }
    } catch (e) {
      console.warn('Αποτυχία φόρτωσης εξωτερικού άρθρου, χρήση περιγραφής RSS:', e);
      setFullArticleHtml(defaultText);
    } finally {
      setLoadingFullText(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>🗞 Εφαρμογή Ειδήσεων RSS</h1>
        <p>Τελευταίες ειδήσεις σε πραγματικό χρόνο</p>
        
        {/* 🔄 ΚΟΥΜΠΙ ΑΝΑΝΕΩΣΗΣ (REFRESH) */}
        <button 
          className="refresh-btn" 
          onClick={fetchAllNews} 
          disabled={loading}
        >
          {loading ? '🔄 Ανανέωση...' : '🔄 Ανανέωση Ειδήσεων'}
        </button>
      </header>

      {loading && <div className="status">Φόρτωση ειδήσεων...</div>}
      {error && <div className="status error">{error}</div>}

      {/* Reader View */}
      {!loading && !error && selectedArticle ? (
        <div className="article-reader">
          <div className="reader-actions">
            <button 
              className="back-btn" 
              onClick={() => setSelectedArticle(null)}
            >
              ← Πίσω στη λίστα ειδήσεων
            </button>
            <button
              className="iframe-btn"
              onClick={() => setIframeUrl(selectedArticle.link)}
            >
              🖥️ Προβολή σε iframe
            </button>
          </div>

          <article className="full-article">
            {(selectedArticle.thumbnail || selectedArticle.enclosure?.link) && (
              <img
                src={selectedArticle.thumbnail || selectedArticle.enclosure?.link}
                alt={selectedArticle.title}
                className="reader-image"
              />
            )}
            
            {selectedArticle.sourceTitle && (
              <span className="source-badge">📍 {selectedArticle.sourceTitle}</span>
            )}

            <h2>{selectedArticle.title}</h2>
            <p className="pub-date">
              📅 {formatToLocalTime(selectedArticle.pubDate)}
            </p>
            
            {loadingFullText ? (
              <p><i>Φόρτωση πλήρους κειμένου...</i></p>
            ) : (
              <div 
                className="article-body"
                dangerouslySetInnerHTML={{ 
                  __html: fullArticleHtml || selectedArticle.content || selectedArticle.description 
                }} 
              />
            )}
            
            <hr />
            <p className="original-link">
              Πηγή: <a href={selectedArticle.link} target="_blank" rel="noopener noreferrer">Δείτε το πρωτότυπο άρθρο</a>
            </p>
          </article>
        </div>
      ) : (
        /* Λίστα Ειδήσεων */
        !loading && !error && (
          <div className="news-grid">
            {articles.map((item, index) => (
              <article key={index} className="news-card">
                {(item.thumbnail || item.enclosure?.link) && (
                  <img
                    src={item.thumbnail || item.enclosure?.link}
                    alt={item.title}
                    className="news-image"
                  />
                )}
                <div className="news-content">
                  {item.sourceTitle && (
                    <span className="source-badge">📍 {item.sourceTitle}</span>
                  )}

                  <h2>{item.title}</h2>
                  
                  <p className="pub-date">
                    📅 {formatToLocalTime(item.pubDate)}
                  </p>

                  <p className="news-excerpt">{getCleanDescription(item)}</p>

                  <button
                    type="button"
                    className="read-more-btn"
                    onClick={() => handleOpenArticle(item)}
                  >
                    Διαβάστε περισσότερα →
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      )}

      {/* Iframe Modal */}
      {iframeUrl && (
        <div className="iframe-modal-overlay" onClick={() => setIframeUrl(null)}>
          <div className="iframe-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="iframe-header">
              <span>Προβολή Ιστοσελίδας</span>
              <button className="close-iframe-btn" onClick={() => setIframeUrl(null)}>
                ✖ Κλείσιμο
              </button>
            </div>
            <iframe
              src={iframeUrl}
              title="Προβολή εξωτερικής σελίδας"
              className="news-iframe"
            />
          </div>
        </div>
      )}

    </div>
  );
}

export default App;