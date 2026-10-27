Imports System.Text
Imports System.Security.Cryptography
Imports System.IO

Module modCommon

    'AppConnectionString of the Web.config, encrypted (DecryptString)
    Private ReadOnly lcConSql As String = ConfigurationManager.ConnectionStrings("AppConnectionString").ConnectionString()

    Public ReadOnly Property AppConnectionString As String
        Get
            Return DecryptString(lcConSql, DecPS("REDACTED"))
        End Get
    End Property

    'SuperStore Return Goods : the location and user code of this IIS site (shown on the device, used on save)
    Public ReadOnly Property AppLocation As String
        Get
            Return If(ConfigurationManager.AppSettings("Location"), "").Trim()
        End Get
    End Property

    Public ReadOnly Property AppUserCode As String
        Get
            Return If(ConfigurationManager.AppSettings("UserCode"), "").Trim()
        End Get
    End Property

#Region "Encryption"

    Private initVector As String = "REDACTED"
    Private keysize As Integer = 256

    Public Function DecPS(ByVal spwd1 As String) As String
        Dim lp As Integer
        Try
            lp = Len(spwd1)
            For i = 1 To lp
                DecPS = DecPS + System.Text.Encoding.GetEncoding("windows-1256").GetString(System.Text.Encoding.GetEncoding("windows-1252").GetBytes(Chr(Asc(Microsoft.VisualBasic.Right(spwd1, i)) - lp)))
            Next i
        Catch ex As Exception
            Throw ex
        End Try
    End Function

    Public Function DecryptString(ByVal cipherText As String, ByVal passPhrase As String) As String

        Try

            Dim initVectorBytes As Byte() = Encoding.UTF8.GetBytes(initVector)
            Dim cipherTextBytes As Byte() = Convert.FromBase64String(cipherText)
            Dim password As PasswordDeriveBytes = New PasswordDeriveBytes(passPhrase, Nothing)
            Dim keyBytes As Byte() = password.GetBytes(CInt(keysize / 8))
            Dim symmetricKey As RijndaelManaged = New RijndaelManaged()
            symmetricKey.Mode = CipherMode.CBC
            Dim decryptor As ICryptoTransform = symmetricKey.CreateDecryptor(keyBytes, initVectorBytes)
            Using memoryStream As New MemoryStream(cipherTextBytes)
                Using cryptoStream As New CryptoStream(memoryStream, decryptor, CryptoStreamMode.Read)
                    Using reader As New StreamReader(cryptoStream, Encoding.UTF8)
                        Return reader.ReadToEnd()
                    End Using
                End Using
            End Using

        Catch ex As Exception
            Return ""
        End Try

    End Function

#End Region

End Module
