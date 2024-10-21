document.addEventListener('DOMContentLoaded', function() {
    const snippets = document.querySelectorAll('.snippet');
    
    snippets.forEach(snippet => {
        const terms = JSON.parse(snippet.getAttribute('data-terms'));
        
        let content = snippet.textContent;
        
        terms.forEach(term => {
            
            const regex = new RegExp(`\\b${term}\\b`, 'giu');
            content = content.replace(regex, match => `<span class='highlight'>${match}</span>`);
        });
        
        snippet.innerHTML = content;
    });
});