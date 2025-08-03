using System.Windows.Controls;

namespace DriveBox.Views.Pages
{
    public partial class DashboardPage : Page
    {
        public DashboardPage()
        {
            InitializeComponent();
            this.Loaded += DashboardPage_Loaded;
        }

        private async void DashboardPage_Loaded(object sender, System.Windows.RoutedEventArgs e)
        {
            try
            {
                if (DataContext is ViewModels.Pages.DashboardViewModel viewModel)
                {
                    if (viewModel.Apps.Count == 0 && !viewModel.IsLoading)
                    {
                                    await Task.Delay(50);
                        await viewModel.LoadAppsAsync();
                    }
                }
            }
            catch (System.Exception)
            {
    
            }
        }
    }
}
