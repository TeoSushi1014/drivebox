using CommunityToolkit.Mvvm.ComponentModel;
using System.Threading.Tasks;
using Wpf.Ui.Abstractions.Controls;

namespace DriveBox.ViewModels.Pages
{
    public partial class DataViewModel : ObservableObject, INavigationAware
    {
        public DataViewModel()
        {
        }

        public Task OnNavigatedToAsync()
        {
            return Task.CompletedTask;
        }

        public Task OnNavigatedFromAsync()
        {
            return Task.CompletedTask;
        }
    }
}