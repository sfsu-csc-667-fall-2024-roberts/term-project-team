document.addEventListener('DOMContentLoaded', function() {
  // Bot options toggle
  const botCountSelect = document.getElementById('bot-count') as HTMLSelectElement;
  if (botCountSelect) {
    const toggleBotOptions = (value: string) => {
      const botOptions = document.getElementById('bot-options');
      if (botOptions) {
        botOptions.style.display = value === '0' ? 'none' : 'block';
      }
    };

    botCountSelect.addEventListener('change', (e) => {
      toggleBotOptions((e.target as HTMLSelectElement).value);
    });
    toggleBotOptions(botCountSelect.value);
  }

  // Handle form submissions
  const handleFormSubmit = async (form: HTMLFormElement, successCallback: (response: Response) => void) => {
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(new FormData(form) as any)
      });

      if (response.ok) {
        successCallback(response);
      } else {
        console.error('Form submission failed');
        window.location.reload();
      }
    } catch (error) {
      console.error('Error:', error);
      window.location.reload();
    }
  };

  // Handle create game form
  const createForm = document.querySelector('.create-game-form');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit(e.target as HTMLFormElement, (response) => {
        window.location.href = response.url;
      });
    });
  }

  // Handle delete game forms
  document.querySelectorAll('.delete-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit(e.target as HTMLFormElement, () => {
        window.location.reload();
      });
    });
  });

  // Handle join game forms
  document.querySelectorAll('.join-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit(e.target as HTMLFormElement, (response) => {
        window.location.href = response.url;
      });
    });
  });

  // Handle leave game forms
  document.querySelectorAll('.leave-form').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFormSubmit(e.target as HTMLFormElement, () => {
        window.location.reload();
      });
    });
  });
}); 