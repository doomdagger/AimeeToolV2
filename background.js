function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: 'Aimee Tool Compass',
    message: message
  });
}
