using DriveBox.Views.Pages;
using DriveBox.Views.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Windows.Threading;
using Wpf.Ui;
using WpfApplication = System.Windows.Application;

namespace DriveBox.Services
{
    
    public class ApplicationHostService(IServiceProvider serviceProvider) : IHostedService
    {
        private readonly IServiceProvider _serviceProvider = serviceProvider;
        private INavigationWindow? _navigationWindow;


        /// <param name="cancellationToken">Indicates that the start process has been aborted.</param>
        public async Task StartAsync(CancellationToken cancellationToken)
        {

            await InitializeWindowAsync();
            

            if (App.IsReadyToShowMainWindow)
            {
                await ShowMainWindowAsync();
            }
            else
            {
                App.ReadyToShowMainWindow += () => 
                {

                    _ = WpfApplication.Current.Dispatcher.InvokeAsync(async () => await ShowMainWindowAsync());
                };
            }
        }


        /// <param name="cancellationToken">Indicates that the shutdown process should no longer be graceful.</param>
        public async Task StopAsync(CancellationToken cancellationToken)
        {
            await Task.CompletedTask;
        }


        private async Task InitializeWindowAsync()
        {
            await WpfApplication.Current.Dispatcher.InvokeAsync(() =>
            {
                if (!WpfApplication.Current.Windows.OfType<MainWindow>().Any())
                {
                    _navigationWindow = (
                        _serviceProvider.GetService(typeof(INavigationWindow)) as INavigationWindow
                    )!;
                    
                    if (_navigationWindow is MainWindow mainWindow)
                    {
                        WpfApplication.Current.MainWindow = mainWindow;
                    }
                    

                }
            });
        }
        
        private async Task ShowMainWindowAsync()
        {
            await WpfApplication.Current.Dispatcher.InvokeAsync(async () =>
            {
                if (_navigationWindow != null)
                {

                    _navigationWindow.ShowWindow();
                    

                    await Task.Delay(100);
                    

                    _navigationWindow.Navigate(typeof(Views.Pages.DashboardPage));
                }
            });
        }
    }
}
