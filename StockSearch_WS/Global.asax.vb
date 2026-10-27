Public Class Global_asax
    Inherits System.Web.HttpApplication

    Sub Application_BeginRequest(ByVal sender As Object, ByVal e As EventArgs)
        ' Fires at the beginning of each request
        Try

            HttpContext.Current.Response.AddHeader("Access-Control-Allow-Origin", "*")
            HttpContext.Current.Response.AddHeader("Access-Control-Allow-Headers", "Content-Type, Accept, token")

        Catch ex As Exception
        End Try
    End Sub

End Class
