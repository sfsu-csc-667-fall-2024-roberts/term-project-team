export class ErrorBoundary {
  private container: HTMLElement;
  private originalContent: string;
  private errorContainer: HTMLElement | null = null;

  constructor(containerId: string) {
    const element = document.getElementById(containerId);
    if (!element) {
      throw new Error(`Container element with id '${containerId}' not found`);
    }
    this.container = element;
    this.originalContent = this.container.innerHTML;
    this.wrapContent();
  }

  private wrapContent(): void {
    // Store original content
    const content = this.container.innerHTML;
    
    // Create error container (hidden by default)
    this.errorContainer = document.createElement('div');
    this.errorContainer.className = 'error-boundary hidden';
    this.errorContainer.innerHTML = `
      <div class="error-content">
        <h3>Something went wrong</h3>
        <p class="error-message"></p>
        <div class="error-actions">
          <button class="retry-button">Retry</button>
          <button class="reset-button">Reset View</button>
        </div>
      </div>
    `;

    // Add event listeners
    const retryButton = this.errorContainer.querySelector('.retry-button');
    const resetButton = this.errorContainer.querySelector('.reset-button');

    if (retryButton) {
      retryButton.addEventListener('click', () => this.retry());
    }

    if (resetButton) {
      resetButton.addEventListener('click', () => this.reset());
    }

    // Clear and update container
    this.container.innerHTML = '';
    this.container.appendChild(this.errorContainer);

    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    contentWrapper.innerHTML = content;
    this.container.appendChild(contentWrapper);
  }

  public handleError(error: Error, componentName: string): void {
    console.error(`Error in component ${componentName}:`, error);

    if (this.errorContainer) {
      const messageElement = this.errorContainer.querySelector('.error-message');
      if (messageElement) {
        messageElement.textContent = `${componentName}: ${error.message}`;
      }
      this.errorContainer.classList.remove('hidden');
    }

    // Hide the content wrapper
    const contentWrapper = this.container.querySelector('.content-wrapper');
    if (contentWrapper) {
      contentWrapper.classList.add('hidden');
    }
  }

  private retry(): void {
    // Hide error container
    if (this.errorContainer) {
      this.errorContainer.classList.add('hidden');
    }

    // Show content wrapper
    const contentWrapper = this.container.querySelector('.content-wrapper');
    if (contentWrapper) {
      contentWrapper.classList.remove('hidden');
    }

    // Dispatch custom event for component to handle
    const event = new CustomEvent('error-boundary-retry');
    this.container.dispatchEvent(event);
  }

  private reset(): void {
    // Reset to original content
    const contentWrapper = this.container.querySelector('.content-wrapper');
    if (contentWrapper) {
      contentWrapper.innerHTML = this.originalContent;
      contentWrapper.classList.remove('hidden');
    }

    // Hide error container
    if (this.errorContainer) {
      this.errorContainer.classList.add('hidden');
    }

    // Dispatch custom event for component to handle
    const event = new CustomEvent('error-boundary-reset');
    this.container.dispatchEvent(event);
  }
}

// Add CSS styles for error boundary
const style = document.createElement('style');
style.textContent = `
  .error-boundary {
    background-color: #fff3f3;
    border: 1px solid #ffcdd2;
    border-radius: 4px;
    padding: 16px;
    margin: 8px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .error-boundary.hidden {
    display: none;
  }

  .error-content {
    text-align: center;
  }

  .error-content h3 {
    color: #d32f2f;
    margin: 0 0 8px 0;
  }

  .error-message {
    color: #666;
    margin: 8px 0;
  }

  .error-actions {
    margin-top: 16px;
  }

  .error-actions button {
    margin: 0 8px;
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .retry-button {
    background-color: #2196f3;
    color: white;
  }

  .retry-button:hover {
    background-color: #1976d2;
  }

  .reset-button {
    background-color: #f44336;
    color: white;
  }

  .reset-button:hover {
    background-color: #d32f2f;
  }

  .content-wrapper.hidden {
    display: none;
  }
`;

document.head.appendChild(style); 