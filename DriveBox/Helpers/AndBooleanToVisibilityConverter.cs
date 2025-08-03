using System;
using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace DriveBox.Helpers
{
    /// <summary>
    /// Converts two boolean values to Visibility.Visible when both are true, otherwise Collapsed.
    /// Use with a MultiBinding supplying exactly two boolean sources.
    /// </summary>
    public class AndBooleanToVisibilityConverter : IMultiValueConverter
    {
        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values == null || values.Length < 2)
                return Visibility.Collapsed;

            bool allTrue = true;
            foreach (var v in values)
            {
                if (v is bool b)
                {
                    allTrue &= b;
                }
                else
                {
                    allTrue = false;
                    break;
                }
            }

            return allTrue ? Visibility.Visible : Visibility.Collapsed;
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotSupportedException();
        }
    }
}